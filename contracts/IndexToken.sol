// SPDX-License-Identifier: BUSL-1.1

/**
 * @title DiversiFi - IndexToken
 * @dev Licensed under Business Source License 1.1.
 *
 * You may not use this code in any production or competing service without
 * written permission from the licensor. The license changes to Apache 2.0
 * on January 1, 2028. See the LICENSE file for full details.
 */

pragma solidity ^0.8.27;

import "./ERC20Permit.sol";
import "openzeppelin-contracts/access/Ownable.sol";
import "./ReserveMath.sol";
import "./interfaces/IDFICrossChainMessenger.sol";
import "./interfaces/IReserveManagerAdmin.sol";
import "./interfaces/IReserveManagerGetters.sol";

//a balance divisor below this level gives sufficient space
//for any reasonable migration, if the balance divisor is above this number,
//further soft migrations are not allowed.
uint96 constant MAX_SAFE_BALANCE_DIVISOR = 2 ** (96 - 4);
uint256 constant MAX_TOTAL_SUPPLY = 2 ** (256 - 96) - 1;
uint8 constant DECIMALS = 18;

contract IndexToken is ERC20Permit, Ownable {
  uint64 private immutable _minBalanceDivisorChangeDelay;
  uint104 private immutable _maxBalanceDivisorChangePerSecondQ96;
  address private _reserveManager;
  IDFICrossChainMessenger[] private _crossChainMessengers;

  struct MigrationSlot0 {
    address nextReserveManager;
    uint96 lastBalanceDivisor;
  }
  MigrationSlot0 private _migrationSlot0;

  struct MigrationSlot1 {
    uint64 migrationStartTimestamp;
    uint64 balanceDivisorChangeStartTimestamp;
    uint104 balanceDivisorChangePerSecondQ96;
  }
  MigrationSlot1 private _migrationSlot1;

  mapping(address => uint256) private _baseBalances;
  // mapping(address => mapping(address => uint256)) private _baseAllowances;
  uint256 private _baseTotalSupply;

  /***********************************************************************************
  *------------------------------Unique Functionality---------------------------------
  ***********************************************************************************/

  modifier migrationCheck(bool checkTrue) {
    if (checkTrue) {
      require(isMigrating(), "reserve manager not migrating");
    } else {
      require(!isMigrating(), "reserve manager is migrating");
    }
    _;
  }

  constructor(
    string memory name, 
    string memory symbol,
    address reserveManager,
    uint64 minBalanceDivisorChangeDelay,
    uint104 maxBalanceDivisorChangePerSecondQ96
  ) ERC20(name, symbol, DECIMALS) ERC20Permit(name) {
    _reserveManager = reserveManager;
    _migrationSlot0.lastBalanceDivisor = ReserveMath.DEFAULT_BALANCE_MULTIPLIER;
    _minBalanceDivisorChangeDelay = minBalanceDivisorChangeDelay;
    _maxBalanceDivisorChangePerSecondQ96 = maxBalanceDivisorChangePerSecondQ96;
  }

  function isMigrating() public view returns (bool) {
    return _migrationSlot0.nextReserveManager != address(0);
  }

  function getNextReserveManager() view external returns (address) {
    return _migrationSlot0.nextReserveManager;
  }

  function getlastBalanceDivisor() view external returns (uint96) {
    return _migrationSlot0.lastBalanceDivisor;
  }

  function getBalanceDivisorChangeStartTimestamp() view external returns (uint64) {
    return _migrationSlot1.balanceDivisorChangeStartTimestamp;
  }

  function getMigrationStartTimestamp() view external returns (uint64) {
    return _migrationSlot1.migrationStartTimestamp;
  }

  function getBalanceDivisorChangePerSecondQ96() view external returns (uint104) {
    return _migrationSlot1.balanceDivisorChangePerSecondQ96;
  }

  function getReserveManager() view external returns (address) {
    return _reserveManager;
  }

  function getCrossChainMessengers() view external returns (IDFICrossChainMessenger[] memory) {
    return _crossChainMessengers;
  }

  function addCrossChainMessenger(address crossChainMessenger) external onlyOwner {
    _crossChainMessengers.push(IDFICrossChainMessenger(crossChainMessenger));
  }

  function removeCrossChainMessenger(address crossChainMessenger) external onlyOwner {
    uint length = _crossChainMessengers.length;
    for(uint i = 0; i < length; i++) {
      if (address(_crossChainMessengers[i]) == crossChainMessenger) {
        _crossChainMessengers[i] = _crossChainMessengers[length - 1];
        _crossChainMessengers.pop();
        return;
      }
    }
    revert("cross chain messenger not found");
  }

  function sendMigrationStartMessages(
    uint96 startingBalanceDivisor,
    uint64 balanceDivisorChangeStartTimestamp, 
    uint104 balanceDivisorChangePerSecondQ96
  ) private {
    uint length = _crossChainMessengers.length;
    for (uint i = 0; i < length; i++) {
      _crossChainMessengers[i].sendStartMigration(
        startingBalanceDivisor, balanceDivisorChangeStartTimestamp, balanceDivisorChangePerSecondQ96
      );
    }
  }

  function sendMigrationFinishMessages(uint96 finalBalanceDivisor) private {
    uint length = _crossChainMessengers.length;
    for (uint i = 0; i < length; i++) {
      _crossChainMessengers[i].sendFinishMigration(finalBalanceDivisor);
    }
  }

  function startMigration(
    address nextReserveManager, 
    uint64 balanceDivisorChangeStartTimestamp,
    uint104 balanceDivisorChangePerSecondQ96
  ) external onlyOwner migrationCheck(false) {
    require(_migrationSlot0.lastBalanceDivisor <= MAX_SAFE_BALANCE_DIVISOR, "balance divisor too high for soft migration");
    require(balanceDivisorChangeStartTimestamp - uint64(block.timestamp) >= _minBalanceDivisorChangeDelay, "balance divisor change delay too short");
    require(balanceDivisorChangePerSecondQ96 <= _maxBalanceDivisorChangePerSecondQ96, "balance divisor change rate too high");
    _migrationSlot0.nextReserveManager = nextReserveManager;
    _migrationSlot1.migrationStartTimestamp = uint64(block.timestamp);
    _migrationSlot1.balanceDivisorChangeStartTimestamp = balanceDivisorChangeStartTimestamp;
    _migrationSlot1.balanceDivisorChangePerSecondQ96 = balanceDivisorChangePerSecondQ96;
    IReserveManagerAdmin(_reserveManager).startEmigration(nextReserveManager);
    sendMigrationStartMessages(
      _migrationSlot0.lastBalanceDivisor, balanceDivisorChangeStartTimestamp, balanceDivisorChangePerSecondQ96
    );
  }

  function finishMigration() external migrationCheck(true) {
    IReserveManagerAdmin(_reserveManager).finishEmigration();

    //infer the exact balance divisor based on the totalScaledReserves of the new reserve manager and the total supply
    uint256 totalReservesScaled = IReserveManagerGetters(_migrationSlot0.nextReserveManager).getTotalReservesScaled();
    uint96 finalBalanceDivisor = ReserveMath.computeFinalBalanceDivisor(
      totalReservesScaled, _baseTotalSupply, _migrationSlot0.lastBalanceDivisor
    );
    _migrationSlot0.lastBalanceDivisor = finalBalanceDivisor;

    _reserveManager = _migrationSlot0.nextReserveManager;
    _migrationSlot0.nextReserveManager = address(0);
    sendMigrationFinishMessages(finalBalanceDivisor);
  }

  function mint(address recipient, uint256 amount) external {
    if (isMigrating()) {
      require(msg.sender == _migrationSlot0.nextReserveManager, "only next reserve manager can mint during migration");
    } else {
      require(msg.sender == _reserveManager, "only reserve manager can mint");
    }
    _mint(recipient, amount);
  }

  function burnFrom(address burnAddress, uint256 amount) external {
    require(msg.sender == _reserveManager, "only reserve manager can burn from");
    _burn(burnAddress, amount);
  }

  function burn(uint256 amount) external {
    _burn(msg.sender, amount);
  }

  function transferFromBase(address from, address to, uint256 baseAmount) external returns (bool) {
    require(from != address(0), "ERC20: transfer from the zero address");
    require(to != address(0), "ERC20: transfer to the zero address");
    uint256 normalizedAmount = scaleFromBase(baseAmount);
    uint256 fromBaseBalance = _baseBalances[from];
    require(fromBaseBalance >= baseAmount, "ERC20: transfer amount exceeds balance");
    unchecked { _baseBalances[from] = fromBaseBalance - baseAmount; }
    _baseBalances[to] += baseAmount;
    _approve(from, msg.sender, allowance(from, msg.sender) - normalizedAmount);
    emit Transfer(from, to, normalizedAmount);
    return true;
  }

  function balanceDivisor() public view returns (uint96) {
    MigrationSlot0 memory migrationSlot0 = _migrationSlot0;
    if (migrationSlot0.nextReserveManager == address(0)) {
      return migrationSlot0.lastBalanceDivisor;
    } else { //we are migrating - the balance divisor is changing
      MigrationSlot1 memory migrationSlot1 = _migrationSlot1;
      if (uint64(block.timestamp) <= migrationSlot1.balanceDivisorChangeStartTimestamp) {
        return migrationSlot0.lastBalanceDivisor;
      }
      uint256 divisorChangeDuration = block.timestamp - uint256(migrationSlot1.balanceDivisorChangeStartTimestamp);
      uint256 compoundedChangeQ96 = ReserveMath.powQ96(uint256(migrationSlot1.balanceDivisorChangePerSecondQ96), divisorChangeDuration);
      return uint96(
        (migrationSlot0.lastBalanceDivisor * compoundedChangeQ96) >> 96
      );
    }
  }

  /***********************************************************************************
  *-----------------------------Overriden Functionality-------------------------------
  ***********************************************************************************/

  //interface starts here
  function totalSupply() public view override returns (uint256) {
    return scaleFromBase(_baseTotalSupply);
  }

  function balanceOf(address account) public view override returns (uint256) {
    return scaleFromBase(_baseBalances[account]);
  }

  function _transfer(
    address from,
    address to,
    uint256 amount
  ) internal override {
    uint256 baseAmount = scaleToBase(amount);
    uint256 fromBaseBalance = _baseBalances[from];

    require(fromBaseBalance >= baseAmount, "ERC20: transfer amount exceeds balance");
    unchecked { _baseBalances[from] = fromBaseBalance - baseAmount; }
    _baseBalances[to] += baseAmount;

    emit Transfer(from, to, amount);
  }

  function _mint(
    address account,
    uint256 amount
  ) internal override {
    require(totalSupply() + amount <= MAX_TOTAL_SUPPLY, "max supply");
    uint256 baseAmount = scaleToBase(amount);

    _baseTotalSupply += baseAmount;
    _baseBalances[account] += baseAmount;
    
    emit Transfer(address(0), account, amount);
  }

  function _burn(
    address account,
    uint256 amount
  ) internal override {
    uint256 baseAmount = scaleToBase(amount);

    uint256 baseAccountBalance = _baseBalances[account];
    require(baseAccountBalance >= baseAmount, "ERC20: burn amount exceeds balance");
    unchecked { _baseBalances[account] = baseAccountBalance - baseAmount; }
    _baseTotalSupply -= baseAmount;

    emit Transfer(account, address(0), amount);
  }

  /***********************************************************************************
  *--------------------------------------Helpers--------------------------------------
  ***********************************************************************************/

  function scaleFromBase(uint256 baseAmount) private view returns (uint256 tokenAmount) {
    return baseAmount / uint256(balanceDivisor());
  }

  function scaleToBase(uint256 tokenAmount) private view returns (uint256 baseAmount) {
    return tokenAmount * uint256(balanceDivisor());
  }
}
