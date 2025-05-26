// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.27;

struct AssetParams {
  address assetAddress;
  uint32 targetAllocation; // a portion of MAX_UINT_32
  uint8 decimals;
}