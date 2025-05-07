// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.27;

struct TickData {
  uint32 allocation; //the allocation of this tick
  uint32 nextAllocation; //the allocation of the next tick
  uint32 price; //the price at the allocation of the tick
  uint32 increaseFee; //the fee to increase the allocation of this asset within this tick
  uint32 decreaseFee; // the fee to decrease the allocation of this asset within this tick
  uint48 priceSlope; //the rate of change in price until it reaches the next tick
}

struct AssetParams {
  uint8 decimals;
  uint32 targetAllocation; // a portion of MAX_UINT_32
  uint32 maxAllocation; // the maximum allowed allocation as a portion of MAX_UINT_32
  uint32 minAllocation; // the minimum allowed allocation as a portion of MAX_UINT_32
  TickData[] tickData;
  uint32[] tickBoundaries;
}