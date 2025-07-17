// SPDX-License-Identifier: BUSL-1.1

/**
 * @title DiversiFi - ILiquidityPoolAdmin.sol
 * @dev Licensed under Business Source License 1.1.
 *
 * You may not use this code in any production or competing service without
 * written permission from the licensor. The license changes to Apache 2.0
 * on January 1, 2028. See the LICENSE file for full details.
 */

pragma solidity ^0.8.27;

import "./DataStructs.sol";

/// @notice These are administrative functions not for regular users and as such are not documented.
/// Anyone wishing to understand them will have to interpret the code.
interface ILiquidityPoolAdmin {
  function setAdmin(address admin) external;
  function setMintFeeQ96(uint256 mintFeeQ96) external;
  function setBurnFeeQ96(uint256 burnFeeQ96) external;
  function setMaxReserves(uint256 maxReserves) external;
  function setMaxReservesIncreaseRateQ96(uint256 maxReservesIncreaseRateQ96) external;
  function setMaxReservesIncreaseCooldown(uint256 maxReservesIncreaseCooldown) external;
  function setTargetAssetParams(AssetParams[] calldata params) external;
  function withdrawFees(address recipient) external;
  function setIsMintEnabled(bool isMintEnabled) external;
  function setEqualizationBounty(uint256 equalizationBounty) external;
  function startMigration(
    address nextLiquidityPool,
    uint64 balanceMultiplierChangeDelay,
    uint96 balanceMultiplierChangePerSecondQ96
  ) external;
}