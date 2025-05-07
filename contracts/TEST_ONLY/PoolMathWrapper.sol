// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import "../PoolMath.sol";
import "hardhat/console.sol";

contract PoolMathWrapper {

  function lnQ128(uint256 x) public pure returns (int256) {
    return PoolMath.lnQ128(x);
  }

  function allocationToFixed(uint32 _allocation) public pure returns (uint256) {
    return PoolMath.allocationToFixed(_allocation);
  }

  function toFixed(uint256 _num) public pure returns (uint256) {
    return PoolMath.toFixed(_num);
  }

  function fromFixed(uint256 _num) public pure returns (uint256) {
    return PoolMath.fromFixed(_num);
  }

  //returns the lower bound of the current tick
  function getTickLowerBoundIndex(
    AssetParams memory _assetParams,
    uint256 _specificReservesScaled,
    uint256 _totalReservesScaled
  ) public pure returns (uint index) {
    return PoolMath.getTickLowerBoundIndex(
        _assetParams,
        _specificReservesScaled,
        _totalReservesScaled
    );
  }

  //scale a token with specified decimals to be the same scale as _targetDecimals
  function scaleDecimals(uint256 _value, uint8 _currentScale, uint8 _targetScale) public pure returns (uint256) {
    return PoolMath.scaleDecimals(
        _value,
        _currentScale,
        _targetScale
    );
  }

  // function scaleDecimals18(uint256 _value, uint8 _currentScale) public pure returns (uint256) {
  //   return PoolMath.scaleDecimals18(
  //       _value,
  //       _currentScale
  //   );
  // }

  // function unscaleDecimals18(uint256 _value, uint8 _targetScale) public pure returns (uint256) {
  //   return PoolMath.unscaleDecimals18(_value, _targetScale);
  // }

  function log2Q128(
    uint256 x
  ) public pure returns (int256) {
    return PoolMath.log2Q128(x);
  }
  
  function maxAllocationCheck(
    uint32 _maxAllocation,
    uint256 specificReservesScaled,
    uint256 totalReservesScaled
  ) public pure {
    return PoolMath.maxAllocationCheck(
        _maxAllocation,
        specificReservesScaled,
        totalReservesScaled
    );
  }

  function minAllocationCheck(
    uint32 _minAllocation,
    uint256 specificReservesScaled,
    uint256 totalReservesScaled
  ) public pure {
    return PoolMath.minAllocationCheck(
        _minAllocation,
        specificReservesScaled,
        totalReservesScaled
    );
  }

  //returns the price as a Q128 unsigned integer
  function calcPrice(
    TickData memory _tick,
    uint256 _specificReserves,
    uint256 _totalReserves
  ) public pure returns (uint256) {
    return PoolMath.calcPrice(_tick, _specificReserves, _totalReserves);
  }

  // function calcStepMaxBurn(
  //   TickData memory _tick,
  //   uint256 _specificReserves,
  //   uint256 _totalReserves
  // ) public pure returns (uint256) {
  //   return PoolMath.calcStepMaxBurn(_tick, _specificReserves, _totalReserves);
  // }

  function calcStepMaxWithdrawal(
    uint32 _allocation,
    uint256 _specificReserves,
    uint256 _totalReserves
  ) public pure returns (uint256) {
    return PoolMath.calcStepMaxWithdrawal(_allocation, _specificReserves, _totalReserves);
  }

  function calcStepMaxDeposit(
    uint32 _allocation,
    uint256 _specificReserves,
    uint256 _totalReserves
  ) public pure returns (uint256) {
    return PoolMath.calcStepMaxDeposit(_allocation, _specificReserves, _totalReserves);
  }

  // function calcStepMaxMint(
  //   TickData memory _tick,
  //   uint256 _specificReserves,
  //   uint256 _totalReserves
  // ) public pure returns (uint256) {
  //   return PoolMath.calcStepMaxMint(_tick, _specificReserves, _totalReserves);
  // }

  function calcStepMint(
    uint256 _depositAmount,
    uint256 _totalReserves,
    uint256 _specificReserves,
    TickData memory _tick
  ) public pure returns (uint256 /*out*/, uint256 /*fee*/) {
    return PoolMath.calcStepMint(
        _depositAmount,
        _totalReserves,
        _specificReserves,
        _tick
    );
  }

  function calcStepDeposit(
    uint256 _mintAmount,
    uint256 _totalReserves,
    uint256 _specificReserves,
    TickData memory _tick
  ) public pure returns (uint256 /*in*/, uint256 /*fee*/) {
    return PoolMath.calcStepDeposit(_mintAmount, _totalReserves, _specificReserves, _tick);
  }

  function calcStepWithdrawal(
    uint256 _burnAmount,//negative
    uint256 _totalReserves,
    uint256 _specificReserves,
    TickData memory _tick
  ) public pure returns (uint256 /*out*/, uint256 /*fee*/) {
    return PoolMath.calcStepWithdrawal(_burnAmount, _totalReserves, _specificReserves, _tick);
  }

  function calcStepBurn(
    uint256 _withdrawAmount,//negative
    uint256 _totalReserves,
    uint256 _specificReserves,
    TickData memory _tick
  ) public pure returns (uint256 /*in*/, uint256 /*fee*/) {
    return PoolMath.calcStepBurn(_withdrawAmount, _totalReserves, _specificReserves, _tick);
  }

  function computeMintGivenDeposit(
    AssetParams memory _assetParams,
    uint256 _depositAmountScaled,
    uint256 _specificReservesScaled,
    uint256 _totalReservesScaled
  ) public pure returns (uint256 mintAmount, uint256 fee) { //returns output amount
    return PoolMath.computeMintGivenDeposit(_assetParams, _depositAmountScaled, _specificReservesScaled, _totalReservesScaled);
  }

  function computeDepositGivenMint(
    AssetParams memory _assetParams,
    uint256 _mintAmount,
    uint256 _specificReservesScaled,
    uint256 _totalReservesScaled
  ) public pure returns (uint256 depositAmountScaled, uint256 fee) {
    return PoolMath.computeDepositGivenMint(_assetParams, _mintAmount, _specificReservesScaled, _totalReservesScaled);
  }

  function computeWithdrawalGivenBurn(
    AssetParams memory _assetParams,
    uint256 _burnAmountScaled,
    uint256 _specificReservesScaled,
    uint256 _totalReservesScaled
  ) public pure returns (uint256 withdrawAmountScaled, uint256 fee) {
    return PoolMath.computeWithdrawalGivenBurn(_assetParams, _burnAmountScaled, _specificReservesScaled, _totalReservesScaled);
  }

  function computeBurnGivenWithdrawal(
    AssetParams memory _assetParams,
    uint256 _withdrawAmountScaled,
    uint256 _specificReservesScaled,
    uint256 _totalReservesScaled
  ) public pure returns (uint256 burnAmount, uint256 fee) {
    return PoolMath.computeBurnGivenWithdrawal(_assetParams, _withdrawAmountScaled, _specificReservesScaled, _totalReservesScaled);
  }

    //swap between underlying assets
  function computeSwapUnderlyingGivenIn(
    AssetParams memory _inputAssetParams, 
    AssetParams memory _outputAssetParams,
    uint256 _inputAmountScaled,
    uint256 _inputReservesScaled,
    uint256 _outputReservesScaled,
    uint256 _totalReservesScaled
  ) public pure returns (uint256,/* outputAmount */ uint256 /* fee */) {
    return PoolMath.computeSwapUnderlyingGivenIn(
      _inputAssetParams, 
      _outputAssetParams, 
      _inputAmountScaled,
      _inputReservesScaled,
      _outputReservesScaled,
      _totalReservesScaled
    );
  }

  function computeSwapUnderlyingGivenOut(
    AssetParams memory _inputAssetParams, 
    AssetParams memory _outputAssetParams,
    uint256 _outputAmountScaled,
    uint256 _inputReservesScaled,
    uint256 _outputReservesScaled,
    uint256 _totalReservesScaled
  ) public pure returns (uint256,/* inputAmount */ uint256 /* fee */) {
    return PoolMath.computeSwapUnderlyingGivenOut(
      _inputAssetParams, 
      _outputAssetParams, 
      _outputAmountScaled,
      _inputReservesScaled,
      _outputReservesScaled,
      _totalReservesScaled
    );
  }
}