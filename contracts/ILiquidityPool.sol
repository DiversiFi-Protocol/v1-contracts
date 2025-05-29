// SPDX-License-Identifier: BUSL-1.1

/**
 * @title DiversiFi - ILiquidityPool.sol
 * @dev Licensed under Business Source License 1.1.
 *
 * You may not use this code in any production or competing service without
 * written permission from the licensor. The license changes to Apache 2.0
 * on January 1, 2028. See the LICENSE file for full details.
 */

pragma solidity ^0.8.27;

import "./DataStructs.sol";

interface ILiquidityPool {
    // ~~~~~~~~~~~~~~~~~~~~~ Public Core Functions ~~~~~~~~~~~~~~~~~~~~~
    function mint(uint256 _mintAmount, address _recipient) external;
    function burn(uint256 _burnAmount) external;

    // ~~~~~~~~~~~~~~~~~~~~ Public Special Functions ~~~~~~~~~~~~~~~~~~~
    function swapTowardsTarget(address _asset, int256 _delta) external;
    function equalizeToTarget(bool _execute) external returns (int256[] memory deltas);

    // ~~~~~~~~~~~~~~~~~~~~~~~~ Public Getters ~~~~~~~~~~~~~~~~~~~~~~~~
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

    // ~~~~~~~~~~~~~~~~~~~~~~~~ Admin Functions ~~~~~~~~~~~~~~~~~~~~~~~~
    function setAdmin(address _admin) external;
    function setMintFeeQ128(uint256 _mintFeeQ128) external;
    function setBurnFeeQ128(uint256 _burnFeeQ128) external;
    function setMaxReserves(uint256 _maxReserves) external;
    function setMaxReservesIncreaseRateQ128(uint256 _maxReservesIncreaseRateQ128) external;
    function setMaxReservesIncreaseCooldown(uint256 _maxReservesIncreaseCooldown) external;
    function setTargetAssetParams(AssetParams[] calldata _params) external;
    function withdrawFees(address _recipient) external;
    function setIsMintEnabled(bool _isMintEnabled) external;
}