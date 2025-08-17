// SPDX-License-Identifier: MIT

pragma solidity ^0.8.27;

import "./IERC20MintAndBurn.sol";

interface IIndexToken is IERC20MintAndBurn {
  function transferFromBase(address from, address to, uint256 baseAmount) external;
  function isMigrating() external view returns (bool);
  function getNextReserveManager() external view returns (address);
  function getlastBalanceDivisor() external view returns (uint96);
  function getMigrationStartTimestamp() external view returns (uint64);
  function getBalanceDivisorChangeStartTimestamp() external view returns (uint64);
  function getBalanceDivisorChangePerSecondQ96() external view returns (uint104);
  function getReserveManager() external view returns (address);
  function startMigration(
    address nextReserveManager, 
    uint64 balanceDivisorChangeStartTimestamp, 
    uint104 balanceDivisorChangePerSecondQ96
  ) external;
  function finishMigration(uint256 totalReservesScaled) external;
  function balanceDivisor() external view returns (uint96);
}