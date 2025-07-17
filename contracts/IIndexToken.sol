// SPDX-License-Identifier: MIT

pragma solidity ^0.8.27;

import "./IERC20MintAndBurn.sol";

interface IIndexToken is IERC20MintAndBurn {
  function isMigrating() external view returns (bool);
  function getNextLiquidityPool() view external returns (address);
  function getLastBalanceMultiplierQ96() view external returns (uint96);
  function getMigrationStartTimestamp() view external returns (uint64);
  function getBalanceMultiplierChangePerSecondQ96() view external returns (uint96);
  function getLiquidityPool() view external returns (address);
  function migrate(
    address nextLiquidityPool, 
    uint64 balanceMultiplierChangeDelay, 
    uint96 balanceMultiplierChangePerSecondQ96
  ) external;
  function finishMigration(uint256 totalReservesScaled) external;
  function mint(address recipient, uint256 amount) external;
  function burnFrom(address burnAddress, uint256 amount) external;
  function balanceMultiplierQ96() external view returns (uint256);
}