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

import "openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";

uint256 constant FIXED_BITS = 96; //fixed point numbers have 96 fractional bits

contract IndexToken is ERC20Permit {
  uint64 private immutable _minBalanceMultiplierChangeDelay;
  uint96 private immutable _maxBalanceMultiplierChangePerSecondQ96;
  address private _liquidityPool;

  struct MigrationSlot0 {
    address nextLiquidityPool;
    uint96 lastBalanceMultiplierQ96;
  }
  MigrationSlot0 private _migrationSlot0;

  struct MigrationSlot1 {
    uint64 migrationStartTimestamp;
    uint64 balanceMultiplierChangeDelay;
    uint96 balanceMultiplierChangePerSecondQ96;
  }
  MigrationSlot1 private _migrationSlot1;

  mapping(address => uint256) private _baseBalances;
  mapping(address => mapping(address => uint256)) private _baseAllowances;
  uint256 private _baseTotalSupply;

  /***********************************************************************************
  *------------------------------Unique Functionality---------------------------------
  ***********************************************************************************/
  modifier onlyLiquidityPool {
    require(_msgSender() == _liquidityPool, "only liquidity pool");
    _;
  }

  modifier migrationCheck(bool checkTrue) {
    if (checkTrue) {
      require(isMigrating(), "liquidityPool not migrating");
    } else {
      require(!isMigrating(), "liquidityPool is migrating");
    }
    _;
  }

  constructor(
    string memory name, 
    string memory symbol,
    address liquidityPool,
    uint64 minBalanceMultiplierChangeDelay,
    uint96 maxBalanceMultiplierChangePerSecondQ96
  ) ERC20(name, symbol) ERC20Permit(name) {
    _liquidityPool = liquidityPool;
    _migrationSlot0.lastBalanceMultiplierQ96 = type(uint96).max;
    minBalanceMultiplierChangeDelay = minBalanceMultiplierChangeDelay;
    maxBalanceMultiplierChangePerSecondQ96 = maxBalanceMultiplierChangePerSecondQ96;
  }

  function isMigrating() public view returns (bool) {
    return _migrationSlot0.nextLiquidityPool != address(0);
  }

  function getNextLiquidityPool() view external returns (address) {
    return _migrationSlot0.nextLiquidityPool;
  }

  function getLastBalanceMultiplierQ96() view external returns (uint96) {
    return _migrationSlot0.lastBalanceMultiplierQ96;
  }

  function getMigrationStartTimestamp() view external returns (uint64) {
    return _migrationSlot1.migrationStartTimestamp;
  }

  function getBalanceMultiplierChangePerSecondQ96() view external returns (uint96) {
    return _migrationSlot1.balanceMultiplierChangePerSecondQ96;
  }

  function getLiquidityPool() view external returns (address) {
    return _liquidityPool;
  }

  function migrate(
    address nextLiquidityPool, 
    uint64 balanceMultiplierChangeDelay,
    uint96 balanceMultiplierChangePerSecondQ96
  ) external onlyLiquidityPool migrationCheck(false) {
    require(balanceMultiplierChangeDelay > _minBalanceMultiplierChangeDelay, "balance multiplier change delay too short");
    require(balanceMultiplierChangePerSecondQ96 < _maxBalanceMultiplierChangePerSecondQ96, "balance multiplier change rate too high");
    _migrationSlot0.nextLiquidityPool = nextLiquidityPool;
    _migrationSlot1.migrationStartTimestamp = uint64(block.timestamp);
    _migrationSlot1.balanceMultiplierChangeDelay = balanceMultiplierChangeDelay;
    _migrationSlot1.balanceMultiplierChangePerSecondQ96 = balanceMultiplierChangePerSecondQ96;
  }

  function finishMigration(uint256 totalReservesScaled) external onlyLiquidityPool migrationCheck(true) {
    _liquidityPool = _migrationSlot0.nextLiquidityPool;
    _migrationSlot0.nextLiquidityPool = address(0);
    //infer the exact balance multiplier based on the totalScaledReserves of the new liquidity pool and the total supply
    _migrationSlot0.lastBalanceMultiplierQ96 = uint96((totalReservesScaled << FIXED_BITS) / _baseTotalSupply);
  }

  function mint(address recipient, uint256 amount) external {
    if (isMigrating()) {
      require(msg.sender == _migrationSlot0.nextLiquidityPool, "only next liquidity pool can mint during migration");
    } else {
      require(msg.sender == _liquidityPool, "only liquidity pool can mint");
    }
    _mint(recipient, amount);
  }

  function burnFrom(address burnAddress, uint256 amount) external onlyLiquidityPool {
    _burn(burnAddress, amount);
  }

  function balanceMultiplierQ96() public view returns (uint256) {
    MigrationSlot0 memory migrationSlot0 = _migrationSlot0;
    if (migrationSlot0.nextLiquidityPool == address(0)) {
      return migrationSlot0.lastBalanceMultiplierQ96;
    } else { //we are migrating - the balance multiplier is changing
      MigrationSlot1 memory migrationSlot1 = _migrationSlot1;
      uint256 timeDiff = block.timestamp - uint256(migrationSlot1.migrationStartTimestamp);
      if (timeDiff <= migrationSlot1.balanceMultiplierChangeDelay) {
        return migrationSlot0.lastBalanceMultiplierQ96;
      } else {
        timeDiff -= migrationSlot1.balanceMultiplierChangeDelay;
      }
      uint256 compoundedChange = powQ96(uint256(migrationSlot1.balanceMultiplierChangePerSecondQ96), timeDiff);
      return (migrationSlot0.lastBalanceMultiplierQ96 * compoundedChange) >> FIXED_BITS;
    }
  }

  /***********************************************************************************
  *-----------------------------Overriden Functionality-------------------------------
  ***********************************************************************************/




  function powQ96(uint256 base, uint256 exp) internal pure returns (uint256 result) {
    result = 1 << FIXED_BITS;
    while (exp > 0) {
      if (exp % 2 == 1) {
        result = (result * base) >> FIXED_BITS;
      }
      base = (base * base) >> FIXED_BITS;
      exp /= 2;
    }
  }

  function scaleFromBase(uint256 baseAmount) internal view returns (uint256 tokenAmount) {
    return (baseAmount * balanceMultiplierQ96()) >> FIXED_BITS;
  }

  function scaleToBase(uint256 tokenAmount) internal view returns (uint256 baseAmount) {
    return (tokenAmount << FIXED_BITS) / balanceMultiplierQ96();
  }

  //interface starts here
  function totalSupply() public view override returns (uint256) {
    return scaleFromBase(_baseTotalSupply);
  }

  function balanceOf(address account) public view override returns (uint256) {
    return scaleFromBase(_baseBalances[account]);
  }

  function allowance(address owner, address spender) public view override returns (uint256) {
    return scaleFromBase(_baseAllowances[owner][spender]);
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

  function _approve(
    address owner,
    address spender,
    uint256 amount
  ) internal override {
    uint256 baseAmount = scaleToBase(amount);
    _baseAllowances[owner][spender] = baseAmount;
    emit Approval(owner, spender, amount);
  }

  function _spendAllowance(
    address owner,
    address spender,
    uint256 amount
  ) internal override {
    uint256 baseAmount = scaleToBase(amount);
    uint256 baseAllowance = _baseAllowances[owner][spender];
    if (baseAllowance != type(uint256).max) {
      require(baseAllowance >= baseAmount, "ERC20: insufficient allowance");
      unchecked { 
        _baseAllowances[owner][spender] = baseAllowance - baseAmount; 
      }
      emit Approval(owner, spender, scaleFromBase(baseAllowance - baseAmount));
    }
  }

  function _mint(
    address account,
    uint256 amount
  ) internal override {
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
}