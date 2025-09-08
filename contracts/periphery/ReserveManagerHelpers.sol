// SPDX-License-Identifier: BUSL-1.1

/**
 * @title DiversiFi - ReserveManagerHelpers.sol
 * @dev Licensed under Business Source License 1.1.
 *
 * You may not use this code in any production or competing service without
 * written permission from the licensor. The license changes to Apache 2.0
 * on January 1, 2028. See the LICENSE file for full details.
 */

pragma solidity ^0.8.27;

import "../interfaces/IReserveManagerGetters.sol";
import "../interfaces/IReserveManagerWrite.sol";
import "../interfaces/IIndexToken.sol";
import "../DataStructs.sol";
import "../ReserveMath.sol";

contract ReserveManagerHelpers {
  IReserveManagerGetters reserveManager;
  IIndexToken indexToken;

  constructor(address reserveManager_) {
    reserveManager = IReserveManagerGetters(reserveManager_);
    indexToken = IIndexToken(reserveManager.getIndexToken());
  }

  /// @dev burns the caller's entire balance, useful if the reserve manager is migrating
  /// and the caller's balance is constantly decreasing, making it difficult to
  /// predict the balance at the moment of execution.
  function burnAll() external {
    uint256 burnAmount = indexToken.balanceOf(msg.sender);
    indexToken.transferFrom(msg.sender, address(this), burnAmount);
    AssetParams[] memory currentAssetParams = reserveManager.getCurrentAssetParams();
    //approve all assets
    for(uint i = 0; i < currentAssetParams.length; i++) {
      IERC20 asset = IERC20(currentAssetParams[i].assetAddress);
      if(asset.allowance(address(this), address(reserveManager)) < type(uint256).max / 2) {
        asset.approve(address(reserveManager), type(uint256).max);
      }
    }
    IReserveManagerWrite(address(reserveManager)).burn(burnAmount, false, "");
    for(uint i = 0; i < currentAssetParams.length; i++) {
      IERC20 asset = IERC20(currentAssetParams[i].assetAddress);
      asset.transfer(msg.sender, asset.balanceOf(address(this)));
    }
  }

  function quoteMint(uint256 mintAmount) external view returns (AssetAmount[] memory inputAmounts, uint256 fee) {
    require(reserveManager.getIsMintEnabled(), "minting disabled");
    fee = ReserveMath.fromFixed(mintAmount * ReserveMath.calcCompoundingFeeRate(reserveManager.getMintFeeQ96()));
    uint256 trueMintAmount = mintAmount + fee;
    AssetParams[] memory targetAssetParamsList = reserveManager.getTargetAssetParams();
    uint256 finalTotalReserves = reserveManager.getTotalReservesScaled();
    inputAmounts = new AssetAmount[](targetAssetParamsList.length);
    for (uint i = 0; i < targetAssetParamsList.length; i++) {
      AssetParams memory params = targetAssetParamsList[i];
      uint256 targetDeposit = ReserveMath.fromFixed(
        ReserveMath.allocationToFixed(params.targetAllocation) * trueMintAmount
      );
      uint256 trueDeposit = ReserveMath.scaleDecimals(targetDeposit, indexToken.decimals(), params.decimals) + 1;//round up
      uint256 trueScaledDeposit = ReserveMath.scaleDecimals(trueDeposit, params.decimals, indexToken.decimals());

      AssetAmount memory assetAmount;
      assetAmount.assetAddress = params.assetAddress;
      assetAmount.amount = trueDeposit;
      inputAmounts[i] = assetAmount;

      finalTotalReserves += trueScaledDeposit;
    }
    uint256 maxTotalReserves = reserveManager.getMaxReserves();
    if(block.timestamp > reserveManager.getLastMaxReservesChangeTimestamp() + reserveManager.getMaxReservesIncreaseCooldown()) {
      maxTotalReserves += ReserveMath.fromFixed(maxTotalReserves * reserveManager.getMaxReservesIncreaseRateQ96());
    } 
    require(finalTotalReserves < maxTotalReserves, "max reserves limit");
  }

  function quoteBurn(uint256 burnAmount) external view returns (AssetAmount[] memory outputAmounts, uint256 fee) {
    uint256 totalReservesScaled = reserveManager.getTotalReservesScaled();
    fee = ReserveMath.fromFixed(burnAmount * reserveManager.getBurnFeeQ96());
    uint256 trueBurnAmount = burnAmount - fee;
    //if burning during a migration, index tokens may be backed by more than 1 unit of reserves,
    //in this case, we must scale up the "true" burn amount proportionally.
    trueBurnAmount = (trueBurnAmount * reserveManager.getMigrationBurnConversionRateQ96()) >> 96;
    AssetParams[] memory currentAssetParamsList = reserveManager.getCurrentAssetParams();
    outputAmounts = new AssetAmount[](currentAssetParamsList.length);
    for (uint i = 0; i < currentAssetParamsList.length; i++) {
      AssetParams memory params = currentAssetParamsList[i];
      uint256 currentAllocation = ReserveMath.toFixed(reserveManager.getSpecificReservesScaled(params.assetAddress)) / totalReservesScaled;

      uint256 targetScaledWithdrawal = ReserveMath.fromFixed(currentAllocation * trueBurnAmount);
      uint256 trueWithdrawal = ReserveMath.scaleDecimals(targetScaledWithdrawal, indexToken.decimals(), params.decimals);

      AssetAmount memory assetAmount;
      assetAmount.assetAddress = params.assetAddress;
      assetAmount.amount = trueWithdrawal;
      outputAmounts[i] = assetAmount;
    }
  }
}