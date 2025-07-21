// SPDX-License-Identifier: MIT

/**
 * @title DiversiFi - LiquidityPool.sol
 */

pragma solidity ^0.8.27;

interface ILiquidityPoolCallback {
  function dfiV1FlashMintCallback(bytes calldata forwardData) external;
  function dfiV1FlashBurnCallback(bytes calldata forwardData) external;
}