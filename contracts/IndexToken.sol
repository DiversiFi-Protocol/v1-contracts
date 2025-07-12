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
import "./DataStructs.sol";

address constant zeroAddress = 0x0000000000000000000000000000000000000000;
uint256 constant FIXED_BITS = 96; //fixed point numbers have 96 fractional bits

contract IndexToken is ERC20Permit {
  address public liquidityPool;
  MigrationSlot0 private _migrationSlot0;
  MigrationSlot1 private _migrationSlot1;


  /***********************************************************************************
  *------------------------------Unique Functionality---------------------------------
  ***********************************************************************************/
  modifier onlyLiquidityPool {
    require(_msgSender() == liquidityPool, "only liquidity pool");
    _;
  }

  modifier migrationCheck(boolean checkTrue) {
    if (checkTrue) {
      require(isMigrating(), "liquidityPool not migrating")
    } else {
      require(!isMigrating(), "liquidityPool is migrating")
    }
    _;
  }

  constructor(
    string memory _name, 
    string memory _symbol,
    address _liquidityPool,
  ) ERC20(_name, _symbol) {
    liquidityPool = _liquidityPool;
  }

  function isMigrating() public returns (boolean) {
    return migrationSlot.nextLiquidityPool != zeroAddress;
  }

  function getMigrationSlot0() external returns (MigrationSlot0) {
    return migrationSlot0;
  }

  function getMigrationSlot1() external returns (MigrationSlot1) {
    return migrationSlot1;
  }

  function migrate(address _nextLiquidityPool, uint96 balanceMultiplierChangePerSecondQ96) external onlyLiquidityPool migrationCheck(false) {
    nextLiquidityPool = _nextLiquidityPool;
    migrationSlot1.migrationStartTimestamp = block.timestamp;
    migrationSlot1.balanceMultiplierChangePerSecondQ96 = balanceMultiplierChangePerSecondQ96;
  }

  function finishMigration(uint256 totalReservesScaled) external onlyLiquidityPool migrationCheck(true) {
    liquidityPool = nextLiquidityPool;
    migrationSlot0.nextLiquidityPool = zeroAddress;
    //infer the exact balance multiplier based on the totalScaledReserves of the new liquidity pool and the total supply
    migrationSlot0.balanceMultiplierQ96 = totalReservesScaled / _baseTotalSupply 
  }

  function mint(address _recipient, uint256 _amount) external onlyLiquidityPool migrationCheck(false) {
    _mint(_recipient, _amount);
  }

  function burnFrom(address _burnAddress, uint256 _amount) external onlyLiquidityPool {
    _burn(_burnAddress, _amount);
  }

  /***********************************************************************************
  *-----------------------------Overriden Functionality-------------------------------
  ***********************************************************************************/

  mapping(address => uint256) private _baseBalances;

  mapping(address => mapping(address => uint256)) private _baseAllowances;

  uint256 private _baseTotalSupply;

  function balanceMultiplierQ96() public returns (uint256) {
    MigrationSlot0 migrationSlot0 = _migrationSlot0;
    if (migrationSlot0.nextLiquidityPool == zeroAddress) {
      return migrationSlot0.balanceMultiplierQ96;
    } else { //we are migrating - the balance multiplier is changing
      MigrationSlot1 migrationslot1 = _migrationSlot1;
      uint256 timeDiff = block.timestamp - uint256(migrationStartTimestamp);
      uint256 compoundedChange = powQ96(uint256(balanceMultiplierChangePerSecondQ96), timeDiff);
      return (migrationSlot0.balanceMultiplierQ96 * compoundedChange) >> FIXED_BITS;
    }
  }

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

  function scaleFromBase(uint256 baseAmount) private returns (uint256 tokenAmount) {
    return (baseAmount * balanceMultiplierQ96()) >> FIXED_BITS;
  }

  function scaleToBase(uint256 tokenAmount) private returns (uint256 baseAmount) {
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
    unchecked { _balances[from] = fromBaseBalance - baseAmount; }
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