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
  /// @dev The returned value is a 128.128 fixed point number
  /// @return mintFeeQ128 The mint fee rate
  function getMintFeeQ128() external view returns (uint256);
  
  /// @dev The returned value is a 128.128 fixed point number
  /// @return burnFeeQ128 The burn fee rate
  function getBurnFeeQ128() external view returns (uint256);

  /// @return isMintEnabled True if minting is enabled, false if minting is disabled
  function getIsMintEnabled() external view returns (bool);

  /// @dev Fees are collected in the pool's index token and denoted in atomic units
  /// @return feesCollected The amount of fees collected by the pool and available for withdrawal
  function getFeesCollected() external view returns (uint256);

  /// @return indexToken The address of the pool's index token
  function getIndexToken() external view returns (address);

  /// @return admin The address of the administrator's account
  function getAdmin() external view returns (address);

  /// @return allAssets An array of the addresses of all active underlying collateral in the pool
  function getAllAssets() external view returns (address[] memory);

  /// @dev Current assets refer to all assets that have liquidity in the pool that are backing index tokens
  /// @return currentAssetParams A list of asset params for every current asset
  function getCurrentAssetParams() external view returns (AssetParams[] memory);

  /// @dev Target assets refer to the assets and allocation that the pool is targetting.
  /// i.e. The pool wants current asset params to equal target asset params, but may not be there yet
  /// @return targetAssetParams A list of asset params that the pool is targetting
  function getTargetAssetParams() external view returns (AssetParams[] memory);

  /// @param asset The address of an asset whose params are being fetched
  /// @return assetParams The params of an individual asset
  function getAssetParams(address asset) external view returns (AssetParams memory);

  /// @dev reserves are scaled to have the same number of decimals as the index token
  /// @param asset The address of an asset scaled reserves are being fetched
  /// @return specificReservesScaled The scaled reserves of an individual asset
  function getSpecificReservesScaled(address asset) external view returns (uint256);

  /// @dev reserves are scaled to have the same number of decimals as the index token
  /// @return totalReservesScaled The sum of the scaled reserves of all current assets
  function getTotalReservesScaled() external view returns (uint256);

  /// @param asset The address of an asset scaled reserves are being fetched
  /// @return specificReserves The actual reserves of a specific asset
  function getSpecificReserves(address asset) external view returns (uint256);

  /// @return maxReserves The current limit on the max value of totalReservesScaled
  function getMaxReserves() external view returns (uint256);

  /// @dev Increase rate is a 128.128 fixed point number that is multiplied by maxReserves
  /// to get the next value of maxReserves. i.e. maxReserves += maxReserves * maxReservesIncreaseRateQ128
  /// @return maxReservesIncreaseRateQ128 The amount maxReserves can be increased in one cooldown cycle. Relative to maxReserves
  function getMaxReservesIncreaseRateQ128() external view returns (uint256);

  /// @dev IncreaseCooldown is denominated in seconds. If this amount of seconds have not passed since the last
  /// time maxReserves were increased, maxReserves will not be able to increase
  /// @return maxReservesIncreaseCooldown The amount of time that must pass between maxReserves increases
  function getMaxReservesIncreaseCooldown() external view returns (uint256);

  /// @dev Used in conjunction with maxReservesIncreaseCooldown to determine if maxReserves increase functionality is on cooldown
  /// @return lastMaxReservesChangeTimestamp The last block.timestamp where maxReserves was increased.
  function getLastMaxReservesChangeTimestamp() external view returns (uint256);
  
  /// @dev Equalization refers to whether or not the pools current reserves are equal to its target reserves
  /// @return isEqualized Whether or not the pool is equalized
  function getIsEqualized() external view returns (bool);

  /// @dev The equalization vector is sorted in the same order as the currentAssetParams list
  /// @return equalizationVectorScaled A list of scaled reserve deltas that would bring the pool to a state of equalization if applied
  function getEqualizationVectorScaled() external view returns (int256[] memory);

  /// @dev See the Proofs section of the V1 whitepaper for an in depth explanation of the Discrepency
  /// strictly, it is the sum of the absolute values of the elements of the equalization vector.
  /// @return totalReservesDiscrepencyScaled The total scaled discrepancy of all reserve assets between their current and target reserves.
  function getTotalReservesDiscrepencyScaled() external view returns (uint256);
}