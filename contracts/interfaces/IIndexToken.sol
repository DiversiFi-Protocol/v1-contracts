// SPDX-License-Identifier: MIT

pragma solidity ^0.8.27;

import "./IERC20MintAndBurn.sol";

interface IIndexToken is IERC20MintAndBurn {
  function isMigrating() external view returns (bool);
  function getNextLiquidityPool() view external returns (address);
  function getlastBalanceDivisor() view external returns (uint96);
  function getMigrationStartTimestamp() view external returns (uint64);
  function getBalanceDivisorChangeDelay() view external returns (uint64);
  function getBalanceDivisorChangePerSecondQ96() view external returns (uint104);
  function getLiquidityPool() view external returns (address);
  function startMigration(
    address nextLiquidityPool, 
    uint64 balanceDivisorChangeDelay, 
    uint104 balanceDivisorChangePerSecondQ96
  ) external;
  function finishMigration(uint256 totalReservesScaled) external;
  function balanceDivisor() external view returns (uint96);
}