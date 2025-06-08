// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.27;

struct AssetParams {
  address assetAddress;
  uint88 targetAllocation; // 0.88 fixed point
  uint8 decimals;
}