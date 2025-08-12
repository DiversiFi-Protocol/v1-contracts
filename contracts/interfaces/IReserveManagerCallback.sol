// SPDX-License-Identifier: MIT

/**
 * @title DiversiFi - IReserveManagerCallback.sol
 */

pragma solidity ^0.8.27;

interface IReserveManagerCallback {
  function dfiV1FlashMintCallback(bytes calldata forwardData) external;
  function dfiV1FlashBurnCallback(bytes calldata forwardData) external;
}