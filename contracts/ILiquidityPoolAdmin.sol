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
  function setAdmin(address _admin) external;
  function setMintFeeQ128(uint256 _mintFeeQ128) external;
  function setBurnFeeQ128(uint256 _burnFeeQ128) external;
  function setMaxReserves(uint256 _maxReserves) external;
  function setMaxReservesIncreaseRateQ128(uint256 _maxReservesIncreaseRateQ128) external;
  function setMaxReservesIncreaseCooldown(uint256 _maxReservesIncreaseCooldown) external;
  function setTargetAssetParams(AssetParams[] calldata _params) external;
  function withdrawFees(address _recipient) external;
  function setIsMintEnabled(bool _isMintEnabled) external;
  function setEqualizationBounty(uint256 _equalizationBounty) external;
}