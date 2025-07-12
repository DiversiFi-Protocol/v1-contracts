// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.27;

struct AssetParams {
  address assetAddress;
  uint88 targetAllocation; // 0.88 fixed point
  uint8 decimals;
}

struct AssetAmount {
  address assetAddress;
  uint256 amount;
}

struct MigrationSlot0 {
  address nextLiquidityPool;
  uint96 balanceMultiplierQ96;
}

struct MigrationSlot1 {
  uint64 migrationStartTimestamp;
  uint96 balanceMultiplierChangePerSecondQ96
}