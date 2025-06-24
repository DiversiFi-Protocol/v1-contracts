// SPDX-License-Identifier: MIT

/**
 * @title DiversiFi - LiquidityPool.sol
 */

pragma solidity ^0.8.27;

interface ILiquidityPoolCallback {
  function mintCallback(bytes calldata forwardData) external;
  function burnCallback(bytes calldata forwardData) external;
}