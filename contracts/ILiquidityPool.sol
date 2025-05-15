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
    function swapGivenIn(
        address _recipient,
        address _inputAsset,
        address _outputAsset,
        uint256 _inputAmount,
        uint256 _minOutput
    ) external returns (uint256, uint256);

    function swapGivenOut(
        address _recipient,
        address _inputAsset,
        address _outputAsset,
        uint256 _outputAmount,
        uint256 _maxInput
    ) external returns (uint256, uint256);

    function mint(uint256 _mintAmount, address _recipient) external;

    function burn(uint256 _burnAmount) external;

    // ~~~~~~~~~~~~~~~~~~~~~~~~ Public Getters ~~~~~~~~~~~~~~~~~~~~~~~~
    function getMaxReservesLimit() external view returns (uint256);

    function getMaxReservesLimitRatioQ128() external view returns (uint256);

    function getMintFeeQ128() external view returns (uint256);

    function getBurnFeeQ128() external view returns (uint256);

    function getIsSwapEnabled() external view returns (bool);

    function getIsDirectMintEnabled() external view returns (bool);

    function getFeesCollected() external view returns (uint256);

    function getLiquidityToken() external view returns (address);

    function getAdmin() external view returns (address);

    function getAllAssets() external view returns (address[] memory);

    function getAsset(uint index) external view returns (address);

    function getAssetParams(address asset) external view returns (AssetParams memory);

    function getSpecificReservesScaled(address asset) external view returns (uint256);

    function getTotalReservesScaled() external view returns (uint256);

    function getSpecificReserves(address _asset) external view returns (uint256);

    function getPriceQ128(address _asset) external view returns (uint256);

    function getLowerTick(address _asset) external view returns (TickData memory);

    // ~~~~~~~~~~~~~~~~~~~~~~~~ Admin Functions ~~~~~~~~~~~~~~~~~~~~~~~~
    function setMintFeeQ128(uint256 _mintFeeQ128) external;

    function setBurnFeeQ128(uint256 _burnFeeQ128) external;

    function setPublicLimitIncreaseCooldown(uint256 _publicLimitIncreaseCooldown) external;

    function setAssetParams(address[] calldata assetAddresses, AssetParams[] calldata _params) external;

    function withdrawFees(address _recipient) external;

    function setIsSwapEnabled(bool _isSwapEnabled) external;

    function setIsDirectMintEnabled(bool _isDirectMintEnabled) external;

    function setIsDepositEnabled(bool _isDepositEnabled) external;

    function recoverFunds(address _asset, address _recipient, uint256 _amount) external;
}