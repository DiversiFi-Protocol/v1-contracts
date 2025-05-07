// SPDX-License-Identifier: BUSL-1.1

/**
 * @title DiversiFi - IBackingPool.sol
 * @dev Licensed under Business Source License 1.1.
 *
 * You may not use this code in any production or competing service without
 * written permission from the licensor. The license changes to Apache 2.0
 * on January 1, 2028. See the LICENSE file for full details.
 */

pragma solidity ^0.8.27;

interface IBackingPool {
    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ Events ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    event Swap(
        address indexed sender,
        address indexed recipient,
        address inputAsset,
        address outputAsset,
        int256 deltaInput,
        int256 deltaOutput,
        uint256 fee
    );

    event Flash(
        address indexed sender,
        address indexed recipient,
        address indexed borrowAsset,
        uint256 borrowAmount,
        uint256 repayAmount
    );

    event ParamsUpdate(
        address indexed asset,
        uint16 targetAllocation,
        uint16 maxAllocation
    );

    event TickUpdate(
        address indexed asset,
        uint8 tickIndex,
        uint16 allocation,
        uint16 price,
        uint16 increaseFee,
        uint32 priceSlope
    );

    // ~~~~~~~~~~~~~~~~~~~~~ Public Core Functions ~~~~~~~~~~~~~~~~~~~~~
    function swapGivenIn(
        address _recipient,
        address _inputAsset,
        address _outputAsset,
        uint256 _inputAmount,
        uint256 _minOutput
    ) external returns (uint256);

    function swapGivenOut(
        address _recipient,
        address _inputAsset,
        address _outputAsset,
        uint256 _outputAmount,
        uint256 _maxInput
    ) external returns (uint256);

    function flash(
        address _recipient,
        address _borrowAsset,
        uint256 _borrowAmount
    ) external returns (uint256);

    function mint(uint256 _mintAmount) external;

    function burn(uint256 _amount) external;

    // ~~~~~~~~~~~~~~~~~~~~~~~~ Public Getters ~~~~~~~~~~~~~~~~~~~~~~~~
    function getFeeRecipient() external view returns (address);

    function getIsFrozen() external view returns (bool);

    function getInsuranceFund() external view returns (address);

    function getBackedToken() external view returns (address);

    function getAdmin() external view returns (address);

    function getAllAssets() external view returns (address[] memory);

    function getAsset(uint index) external view returns (address);

    struct AssetParams {
        address assetAddress;
        uint8 decimals;
        uint16 targetAllocation;
        uint16 maxAllocation;
        // Additional fields can be added here if necessary
    }

    function getAssetParams(address asset) external view returns (AssetParams memory);

    function getSpecificScaledReserves(address asset) external view returns (uint256);

    function getTotalScaledReserves() external view returns (uint256);

    // ~~~~~~~~~~~~~~~~~~~~~~~~ Admin Functions ~~~~~~~~~~~~~~~~~~~~~~~~
    function setAssetParams(AssetParams[] calldata _params) external;

    function withdrawFees(address _recipient) external;

    function setIsFrozen(bool _isFrozen) external;
} 