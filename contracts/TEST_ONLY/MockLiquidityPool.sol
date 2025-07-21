// SPDX-License-Identifier: MIT

pragma solidity ^0.8.27;

import "../ILiquidityPoolGetters.sol";

contract MockLiquidityPool is ILiquidityPoolGetters {
    uint256 public mintFeeQ96;
    uint256 public burnFeeQ96;
    bool public isMintEnabled;
    uint256 public feesCollected;
    address public indexToken;
    address public admin;
    address[] public allAssets;

    AssetParams[] public currentAssetParams;
    AssetParams[] public targetAssetParams;
    mapping(address => AssetParams) public assetParams;
    mapping(address => uint256) public specificReservesScaled;
    mapping(address => uint256) public specificReserves;

    uint256 public totalReservesScaled;
    uint256 public maxReserves;
    uint256 public maxReservesIncreaseRateQ96;
    uint256 public maxReservesIncreaseCooldown;
    uint256 public lastMaxReservesChangeTimestamp;
    uint256 public equalizationBounty;
    bool public isEqualizedFlag;
    int256[] public equalizationVectorScaledList;
    uint256 public totalReservesDiscrepencyScaled;
    uint256 public migrationBurnConversionRateQ96;
    bool public migrating;

    // Getters
    function getMintFeeQ96() external view override returns (uint256) {
        return mintFeeQ96;
    }

    function getBurnFeeQ96() external view override returns (uint256) {
        return burnFeeQ96;
    }

    function getIsMintEnabled() external view override returns (bool) {
        return isMintEnabled;
    }

    function getFeesCollected() external view override returns (uint256) {
        return feesCollected;
    }

    function getIndexToken() external view override returns (address) {
        return indexToken;
    }

    function getAdmin() external view override returns (address) {
        return admin;
    }

    function getAllAssets() external view override returns (address[] memory) {
        return allAssets;
    }

    function getCurrentAssetParams() external view override returns (AssetParams[] memory) {
        return currentAssetParams;
    }

    function getTargetAssetParams() external view override returns (AssetParams[] memory) {
        return targetAssetParams;
    }

    function getAssetParams(address asset) external view override returns (AssetParams memory) {
        return assetParams[asset];
    }

    function getSpecificReservesScaled(address asset) external view override returns (uint256) {
        return specificReservesScaled[asset];
    }

    function getTotalReservesScaled() external view override returns (uint256) {
        return totalReservesScaled;
    }

    function getSpecificReserves(address asset) external view override returns (uint256) {
        return specificReserves[asset];
    }

    function getMaxReserves() external view override returns (uint256) {
        return maxReserves;
    }

    function getMaxReservesIncreaseRateQ96() external view override returns (uint256) {
        return maxReservesIncreaseRateQ96;
    }

    function getMaxReservesIncreaseCooldown() external view override returns (uint256) {
        return maxReservesIncreaseCooldown;
    }

    function getLastMaxReservesChangeTimestamp() external view override returns (uint256) {
        return lastMaxReservesChangeTimestamp;
    }

    function getEqualizationBounty() external view override returns (uint256) {
        return equalizationBounty;
    }

    function getIsEqualized() external view override returns (bool) {
        return isEqualizedFlag;
    }

    function getEqualizationVectorScaled() external view override returns (int256[] memory) {
        return equalizationVectorScaledList;
    }

    function getTotalReservesDiscrepencyScaled() external view override returns (uint256) {
        return totalReservesDiscrepencyScaled;
    }

    function getMigrationBurnConversionRateQ96() external view override returns (uint256) {
        return migrationBurnConversionRateQ96;
    }

    function isMigrating() external view override returns (bool) {
        return migrating;
    }

    // Setters (for mocking purposes)
    function setMintFeeQ96(uint256 val) external { mintFeeQ96 = val; }
    function setBurnFeeQ96(uint256 val) external { burnFeeQ96 = val; }
    function setIsMintEnabled(bool val) external { isMintEnabled = val; }
    function setFeesCollected(uint256 val) external { feesCollected = val; }
    function setIndexToken(address val) external { indexToken = val; }
    function setAdmin(address val) external { admin = val; }
    function setAllAssets(address[] memory val) external { allAssets = val; }
    // function setCurrentAssetParams(AssetParams[] memory val) external { currentAssetParams = val; }
    // function setTargetAssetParams(AssetParams[] memory val) external { targetAssetParams = val; }
    // function setAssetParams(address asset, AssetParams memory val) external { assetParams[asset] = val; }
    function setSpecificReservesScaled(address asset, uint256 val) external { specificReservesScaled[asset] = val; }
    function setTotalReservesScaled(uint256 val) external { totalReservesScaled = val; }
    function setSpecificReserves(address asset, uint256 val) external { specificReserves[asset] = val; }
    function setMaxReserves(uint256 val) external { maxReserves = val; }
    function setMaxReservesIncreaseRateQ96(uint256 val) external { maxReservesIncreaseRateQ96 = val; }
    function setMaxReservesIncreaseCooldown(uint256 val) external { maxReservesIncreaseCooldown = val; }
    function setLastMaxReservesChangeTimestamp(uint256 val) external { lastMaxReservesChangeTimestamp = val; }
    function setEqualizationBounty(uint256 val) external { equalizationBounty = val; }
    function setIsEqualized(bool val) external { isEqualizedFlag = val; }
    function setEqualizationVectorScaled(int256[] memory val) external { equalizationVectorScaledList = val; }
    function setTotalReservesDiscrepencyScaled(uint256 val) external { totalReservesDiscrepencyScaled = val; }
    function setMigrationBurnConversionRateQ96(uint256 val) external { migrationBurnConversionRateQ96 = val; }
    function setMigrating(bool val) external { migrating = val; }
}