// SPDX-License-Identifier: BUSL-1.1

/**
 * @title DiversiFi - LiquidityPoolHelpers.sol
 * @dev Licensed under Business Source License 1.1.
 *
 * You may not use this code in any production or competing service without
 * written permission from the licensor. The license changes to Apache 2.0
 * on January 1, 2028. See the LICENSE file for full details.
 */

pragma solidity ^0.8.27;

import "./interfaces/ILiquidityPoolGetters.sol";
import "./interfaces/ILiquidityPoolWrite.sol";
import "./interfaces/IIndexToken.sol";
import "./DataStructs.sol";
import "./PoolMath.sol";

contract LiquidityPoolHelpers {
  ILiquidityPoolGetters liquidityPool;
  IIndexToken indexToken;

  constructor(address liquidityPool_) {
    liquidityPool = ILiquidityPoolGetters(liquidityPool_);
    indexToken = IIndexToken(liquidityPool.getIndexToken());
  }

  /// @dev burns the caller's entire balance, useful if the pool is migrating
  /// and the caller's balance is constantly decreasing, making it difficult to
  /// predict the balance at the moment of execution.
  function burnAll() external {
    uint256 burnAmount = indexToken.balanceOf(msg.sender);
    AssetParams[] memory currentAssetParams = liquidityPool.getCurrentAssetParams();
    //approve all assets
    for(uint i = 0; i < currentAssetParams.length; i++) {
      IERC20 asset = IERC20(currentAssetParams[i].assetAddress);
      if(asset.allowance(address(this), address(liquidityPool)) < type(uint256).max / 2) {
        asset.approve(address(liquidityPool), type(uint256).max);
      }
    }
    ILiquidityPoolWrite(address(liquidityPool)).burn(burnAmount, "");
    for(uint i = 0; i < currentAssetParams.length; i++) {
      IERC20 asset = IERC20(currentAssetParams[i].assetAddress);
      asset.transfer(msg.sender, asset.balanceOf(address(this)));
    }
  }

  function quoteMint(uint256 mintAmount) external returns (AssetAmount[] memory inputAmounts) {
    require(liquidityPool.getIsMintEnabled(), "minting disabled");
    uint256 fee = PoolMath.fromFixed(mintAmount * PoolMath.calcCompoundingFeeRate(liquidityPool.getMintFeeQ96()));
    uint256 trueMintAmount = mintAmount + fee;
    AssetParams[] memory targetAssetParamsList = liquidityPool.getTargetAssetParams();
    uint256 finalTotalReserves = liquidityPool.getTotalReservesScaled();
    inputAmounts = new AssetAmount[](targetAssetParamsList.length);
    for (uint i = 0; i < targetAssetParamsList.length; i++) {
      AssetParams memory params = targetAssetParamsList[i];
      uint256 targetDeposit = PoolMath.fromFixed(
        PoolMath.allocationToFixed(params.targetAllocation) * trueMintAmount
      );
      uint256 trueDeposit = PoolMath.scaleDecimals(targetDeposit, indexToken.decimals(), params.decimals) + 1;//round up
      uint256 trueScaledDeposit = PoolMath.scaleDecimals(trueDeposit, params.decimals, indexToken.decimals());

      AssetAmount memory assetAmount;
      assetAmount.assetAddress = params.assetAddress;
      assetAmount.amount = trueDeposit;
      inputAmounts[i] = assetAmount;

      finalTotalReserves += trueScaledDeposit;
    }
    uint256 maxTotalReserves = liquidityPool.getMaxReserves();
    if(block.timestamp > liquidityPool.getLastMaxReservesChangeTimestamp() + liquidityPool.getMaxReservesIncreaseCooldown()) {
      maxTotalReserves += PoolMath.fromFixed(maxTotalReserves * liquidityPool.getMaxReservesIncreaseRateQ96());
    } 
    require(finalTotalReserves < maxTotalReserves, "max reserves limit");
  }

  function quoteBurn(uint256 burnAmount) external returns (AssetAmount[] memory outputAmounts) {
    uint256 totalReservesScaled = liquidityPool.getTotalReservesScaled();
    uint256 fee = PoolMath.fromFixed(burnAmount * liquidityPool.getBurnFeeQ96());
    uint256 trueBurnAmount = burnAmount - fee;
    //if burning during a migration, index tokens may be backed by more than 1 unit of reserves,
    //in this case, we must scale up the "true" burn amount proportionally.
    trueBurnAmount = (trueBurnAmount * liquidityPool.getMigrationBurnConversionRateQ96()) >> 96;
    AssetParams[] memory currentAssetParamsList = liquidityPool.getCurrentAssetParams();
    outputAmounts = new AssetAmount[](currentAssetParamsList.length);
    for (uint i = 0; i < currentAssetParamsList.length; i++) {
      AssetParams memory params = currentAssetParamsList[i];
      uint256 currentAllocation = PoolMath.toFixed(liquidityPool.getSpecificReservesScaled(params.assetAddress)) / totalReservesScaled;

      uint256 targetScaledWithdrawal = PoolMath.fromFixed(currentAllocation * trueBurnAmount);
      uint256 trueWithdrawal = PoolMath.scaleDecimals(targetScaledWithdrawal, indexToken.decimals(), params.decimals);

      AssetAmount memory assetAmount;
      assetAmount.assetAddress = params.assetAddress;
      assetAmount.amount = trueWithdrawal;
      outputAmounts[i] = assetAmount;
    }
    return outputAmounts;
  }
}