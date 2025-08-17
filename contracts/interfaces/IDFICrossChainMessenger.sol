// SPDX-License-Identifier: MIT

pragma solidity ^0.8.27;

interface IDFICrossChainMessenger {
  function sendStartMigration(
    uint96 startingBalanceDivisor,
    uint64 balanceDivisorChangeStartTimestamp, 
    uint104 balanceDivisorChangePerSecondQ96
  ) external;
  function sendFinishMigration(uint96 finalBalanceDivisor) external;
}