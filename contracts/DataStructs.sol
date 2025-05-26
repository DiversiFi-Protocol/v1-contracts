// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.27;

struct AssetParams {
  address assetAddress;
  uint88 targetAllocation; // a portion of MAX_UINT_88
  uint8 decimals;
}