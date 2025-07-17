// SPDX-License-Identifier: MIT

pragma solidity ^0.8.27

import "./DataStructs.sol";

//liquidity pool functions that support the standard soft migration
//any contract that the pool migrates to should support these methods at an absolute minimum.
//Migration to a contract that doesn't support these methods should be carried out through a
//hard migration because it would be a significant change to the protocol.
interface ILiquidityPoolMigration {
  function mint(uint256 mintAmount, bytes forwardData) external nonReentrant returns (AssetAmount[] inputAmounts);
  function burn(uint256 burnAmount, bytes forwardData) external nonReentrant returns (AssetAmount[] outputAmounts);
  function startMigration(
    address nextLiquidityPool,
    uint64 balanceMultiplierChangeDelay,
    uint96 balanceMultiplierChangePerSecondQ96,
    bytes extraData
  ) external;
}
