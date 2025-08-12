// SPDX-License-Identifier: BUSL-1.1

/**
 * @title DiversiFi - IReserveManagerGetters.sol
 * @dev Licensed under Business Source License 1.1.
 *
 * You may not use this code in any production or competing service without
 * written permission from the licensor. The license changes to Apache 2.0
 * on January 1, 2028. See the LICENSE file for full details.
 */

pragma solidity ^0.8.27;

import "../DataStructs.sol";

interface IReserveManagerGetters {
  /// @dev The returned value is a 96.96 fixed point number
  /// @return mintFeeQ96 The mint fee rate
  function getMintFeeQ96() external view returns (uint256);

  /// @dev the returned value is a 96.96 fixed point numbe
  /// The compounding fee refers the the fee for minting n tokens,
  /// plus the fee to mint the tokens for the fee, plus the fee of minting the fee.. etc etc
  /// @return compoundingMintFeeQ96 The effective mint fee when minting n tokens
  function getCompoundingMintFeeQ96() external view returns (uint256);
  
  /// @dev The returned value is a 96.96 fixed point number
  /// compounding burn fee is not needed like with the mint fee
  /// @return burnFeeQ96 The burn fee rate
  function getBurnFeeQ96() external view returns (uint256);

  /// @return isMintEnabled True if minting is enabled, false if minting is disabled
  function getIsMintEnabled() external view returns (bool);

  /// @dev Swap fees accumulate into the reserve surplus, the surplus is equal to:
  /// totalReservesScaled - indexToken.totalSupply - equalizationBounty
  /// @return surplus The surplus of reserves vs total supply of the index token
  function getSurplus() external view returns (int256);

  /// @return indexToken The address of the reserve manager's index token
  function getIndexToken() external view returns (address);

  /// @return allAssets An array of the addresses of all active underlying collateral in the reserve manager
  function getAllAssets() external view returns (address[] memory);

  /// @dev Current assets refer to all assets held by the reserve manager that are backing index tokens
  /// @return currentAssetParams A list of asset params for every current asset
  function getCurrentAssetParams() external view returns (AssetParams[] memory);

  /// @dev Target assets refer to the assets and allocation that the reserve manager is targetting.
  /// i.e. The reserve manager wants current asset params to equal target asset params, but may not be there yet
  /// @return targetAssetParams A list of asset params that the reserve manager is targetting
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

  /// @dev Increase rate is a 96.96 fixed point number that is multiplied by maxReserves
  /// to get the next value of maxReserves. i.e. maxReserves += maxReserves * maxReservesIncreaseRateQ96
  /// @return maxReservesIncreaseRateQ96 The amount maxReserves can be increased in one cooldown cycle. Relative to maxReserves
  function getMaxReservesIncreaseRateQ96() external view returns (uint256);

  /// @dev IncreaseCooldown is denominated in seconds. If this amount of seconds have not passed since the last
  /// time maxReserves were increased, maxReserves will not be able to increase
  /// @return maxReservesIncreaseCooldown The amount of time that must pass between maxReserves increases
  function getMaxReservesIncreaseCooldown() external view returns (uint256);

  /// @dev Used in conjunction with maxReservesIncreaseCooldown to determine if maxReserves increase functionality is on cooldown
  /// @return lastMaxReservesChangeTimestamp The last block.timestamp where maxReserves was increased.
  function getLastMaxReservesChangeTimestamp() external view returns (uint256);
  
  /// @dev A reward in the index token applied as a discount/premium to traders who call arbitrage functions
  /// that move the manager's reserves closer to equalization with the target allocations.
  /// @return equalizationBounty The total reward for bringing the  to equalization
  function getEqualizationBounty() external view returns (uint256);

  /// @dev Equalization refers to whether or not the manager's current reserves are equal to its target reserves
  /// @return isEqualized Whether or not the  is equalized
  function getIsEqualized() external view returns (bool);

  /// @dev The equalization vector is sorted in the same order as the currentAssetParams list
  /// @return equalizationVectorScaled A list of scaled reserve deltas that would bring the  to a state of equalization if applied
  function getEqualizationVectorScaled() external view returns (int256[] memory);

  /// @dev See the Proofs section of the V1 whitepaper for an in depth explanation of the Discrepency
  /// strictly, it is the sum of the absolute values of the elements of the equalization vector.
  /// @return totalReservesDiscrepencyScaled The total scaled discrepancy of all reserve assets between their current and target reserves.
  function getTotalReservesDiscrepencyScaled() external view returns (uint256);

  /// @dev conversion rate is stored as a fixed point number with 96 fractional bits, multiplying this number
  /// by the amount of tokens being burned during a migration gives the amount of reserves that would be received.
  /// if there is no migration, this number is always 1.
  /// @return conversionRateQ96 the migration conversion rate of index tokens to totalReserves
  function getMigrationBurnConversionRateQ96() external view returns (uint256);

  /// @dev Emigrating in this context refers to a soft migration where reserves are moving to a new reserve manager
  /// @return isEmigrating true if the reserves are Emigrating, false if not
  function isEmigrating() external view returns (bool);
}