// SPDX-License-Identifier: BUSL-1.1

/**
 * @title DiversiFi - ILiquidityPoolGetters.sol
 * @dev Licensed under Business Source License 1.1.
 *
 * You may not use this code in any production or competing service without
 * written permission from the licensor. The license changes to Apache 2.0
 * on January 1, 2028. See the LICENSE file for full details.
 */

pragma solidity ^0.8.27;

import "./DataStructs.sol";

interface ILiquidityPoolGetters {
  function getMintFeeQ128() external view returns (uint256);
  function getBurnFeeQ128() external view returns (uint256);
  function getIsMintEnabled() external view returns (bool);
  function getFeesCollected() external view returns (uint256);
  function getIndexToken() external view returns (address);
  function getAdmin() external view returns (address);
  function getAllAssets() external view returns (address[] memory);
  function getCurrentAssetParams() external view returns (AssetParams[] memory);
  function getTargetAssetParams() external view returns (AssetParams[] memory);
  function getAssetParams(address asset) external view returns (AssetParams memory);
  function getSpecificReservesScaled(address asset) external view returns (uint256);
  function getTotalReservesScaled() external view returns (uint256);
  function getSpecificReserves(address _asset) external view returns (uint256);
  function getMaxReserves() external view returns (uint256);
  function getMaxReservesIncreaseRateQ128() external view returns (uint256);
  function getMaxReservesIncreaseCooldown() external view returns (uint256);
  function getLastMaxReservesChangeTimestamp() external view returns (uint256);
  function getIsEqualized() external view returns (bool);
  function getEqualizationVectorScaled() external view returns (int256[] memory);
}