// SPDX-License-Identifier: BUSL-1.1

/**
 * @title DiversiFi - PoolMath.sol
 * @dev Licensed under Business Source License 1.1.
 *
 * You may not use this code in any production or competing service without
 * written permission from the licensor. The license changes to Apache 2.0
 * on January 1, 2028. See the LICENSE file for full details.
 */

pragma solidity ^0.8.27;

import "openzeppelin/contracts/utils/math/Math.sol";
import "openzeppelin/contracts/utils/math/SignedMath.sol";
import "./DataStructs.sol";
import "hardhat/console.sol";
// import "./NaturalLog128x128.sol";

uint256 constant LnEQ128 = 0xB17217F7D1CF8032BEEA9A2102AD522C;//The natural Logarithm of Euler's number in fixed point 128.128

library PoolMath {
  uint256 constant SHIFT = 128; //shift a normal integer to get 128.128 fixed point
  uint256 constant PRICE_SLOPE_SHIFT = SHIFT - 41; //shift 7.41 fixed point to get 128.128 fixed point
  uint256 constant PRICE_SHIFT = SHIFT - 31; //shift 1.31 fixed point to get 128.128 fixed point
  uint256 constant ALLOCATION_SHIFT = SHIFT - 32; //shift 0.32 fixed point to get 128.128 fixed point
  uint256 constant FEE_SHIFT = SHIFT - 32; //shift 0.32 fixed point to get 128.128 fixed point
  uint256 constant SCALE = 2 ** SHIFT; //1 shifted by shift
  uint8 constant DEFAULT_DECIMALS = 18;

  function allocationToFixed(uint32 _allocation) internal pure returns (uint256) {
    return uint256(_allocation) << ALLOCATION_SHIFT;
  }

  function fixedToAllocation(uint256 _fixed) internal pure returns (uint32) {
    return uint32(_fixed >> ALLOCATION_SHIFT);
  }

  function toFixed(uint256 _num) internal pure returns (uint256) {
    return _num << SHIFT;
  }

  function fromFixed(uint256 _num) internal pure returns (uint256) {
    return _num >> SHIFT;
  }

  //calculates the equivalent fee rate when you need to take a
  //fee of a fee of a fee .... to infinity
  function calcCompoundingFeeRate(uint256 _feeRateQ128) internal pure returns (uint256) {
    return (_feeRateQ128 << SHIFT) / (SCALE - _feeRateQ128);
  }

  //returns the lower bound of the current tick
  function getTickLowerBoundIndex(
    AssetParams memory _assetParams,
    uint256 _specificReservesScaled,
    uint256 _totalReservesScaled
  ) internal pure returns (uint index) {
    uint256 specificAllocation = (toFixed(_specificReservesScaled) / _totalReservesScaled) >> ALLOCATION_SHIFT;
    for (index = 0; index < _assetParams.tickBoundaries.length; index++) {
      if (specificAllocation < _assetParams.tickBoundaries[index]) {
        break;
      }
    }
    if (index == 0) {
      return 0;
    } else {
      return index - 1;
    }
  }

  //scale a token with specified decimals to be the same scale as _targetDecimals
  function scaleDecimals(uint256 _value, uint8 _currentScale, uint8 _targetScale) internal pure returns (uint256) {
    if (_currentScale == _targetScale) {
      return _value;
    } else if (_currentScale < _targetScale) {
      return _value * uint256(10 ** (_targetScale - _currentScale));
    } else /* _decimals > DEFAULT_DECIMALS */{
      return _value / uint256(10 ** (_currentScale - _targetScale));
    }
  }

  function maxAllocationCheck(
    uint32 _maxAllocation,
    uint256 specificReservesScaled,
    uint256 totalReservesScaled
  ) internal pure  {
    if(_maxAllocation == type(uint32).max) {
      return;
    }
    uint32 currentAllocation = uint32((specificReservesScaled << SHIFT) / totalReservesScaled >> ALLOCATION_SHIFT);
    //+1 because there may be discrepency between the max deposit/withdrawal
    //and the max allocation due to precision loss
    require(currentAllocation < _maxAllocation + 1, "reserves gt max alloc");
  }

  function minAllocationCheck(
    uint32 _minAllocation,
    uint256 specificReservesScaled,
    uint256 totalReservesScaled
  ) internal pure {
    if (_minAllocation == 0) {
      return;
    }
    uint32 currentAllocation = uint32((specificReservesScaled << SHIFT) / totalReservesScaled >> ALLOCATION_SHIFT);
    //-1 because there may be discrepency between the max deposit/withdrawal
    //and the max allocation due to precision loss
    require(currentAllocation > _minAllocation - 1, "reserves lt min alloc");
  }

  //returns the price as a Q128 unsigned integer
  //errors if reserves are outside of the tick's domain
  function calcPrice(
    TickData memory _tick,
    uint256 _specificReserves,
    uint256 _totalReserves
  ) internal pure returns (uint256) {
    uint256 nextTickAlloc = uint256(_tick.nextAllocation) << ALLOCATION_SHIFT;
    require((nextTickAlloc * _totalReserves) >> SHIFT > _specificReserves, "reserves above tick domain");
    uint256 tickAlloc = uint256(_tick.allocation) << ALLOCATION_SHIFT;
    uint256 tickReserves = _totalReserves * tickAlloc >> SHIFT;
    require(tickReserves <= _specificReserves, "reserves below tick domain");
    uint256 reservesDiff;
    unchecked { //can be unchecked because we already do the check in the above require statement
      reservesDiff = _specificReserves - tickReserves;
    }
    uint256 mReserves = (uint256(_tick.priceSlope) << PRICE_SLOPE_SHIFT) / _totalReserves;
    uint256 tickPrice = uint256(_tick.price) << PRICE_SHIFT;
    return tickPrice - (reservesDiff * mReserves);
  }

  /*
    NOTES: slight rounding errors are present in this function, it should
    not be expected to return the delta required to move an allocation firmly into
    the next tick, although we are effectively only off by at most 2e^-18.
    We should simply behave as if we are in the next tick after withdrawing this amount.
    Because these amounts are so small it has been determined that correcting them would
    be a waste of gas.
  */
  function calcStepMaxWithdrawal(
    uint32 _allocation,
    uint256 _specificReserves,
    uint256 _totalReserves
  ) internal pure returns (uint256) {
    if (_allocation == 0) { //min allocation is zero, all reserves are available for withdrawal
      return _specificReserves;
    }
    uint256 normalizedAllocation = uint256(_allocation) << ALLOCATION_SHIFT;
    uint256 numerator = (_specificReserves - ((normalizedAllocation * _totalReserves) >> SHIFT )) << SHIFT;
    uint256 denominator = SCALE - normalizedAllocation;
    return numerator / denominator;
  }


  /*
    NOTES: slight rounding errors are present in this function, it should
    not be expected to return the delta required to move an allocation firmly into
    the next tick, although we are effectively only off by at most 2e^-18.
    We should simply behave as if we are in the next tick after depositing this amount.
    Because these amounts are so small it has been determined that correcting them would
    be a waste of gas.
  */
  function calcStepMaxDeposit(
    uint32 _allocation,
    uint256 _specificReserves,
    uint256 _totalReserves
  ) internal pure returns (uint256) {
    if (_allocation == type(uint32).max) { //the max allocation is 100%, meaining the max deposit is unlimited
      unchecked {
        uint256 maxUint256 = 0;
        return maxUint256 - 1;
      }
    }
    uint256 normalizedAllocation = uint256(_allocation) << ALLOCATION_SHIFT;
    uint256 tickMinimumReserves = (normalizedAllocation * _totalReserves) >> SHIFT;
    uint256 numerator = (tickMinimumReserves - _specificReserves) << SHIFT;

    uint256 denominator = SCALE - normalizedAllocation;
    return numerator / denominator;
  }

  function log2Q128(uint256 _logArg) internal pure returns (int256) {
    unchecked {
      int256 mostSignificantBit = 0;
      uint256 x = _logArg;
      
      //determine integer part
      if (x >= 0x100000000000000000000000000000000) { x >>= 128; mostSignificantBit += 128; }
      if (x >= 0x10000000000000000) { x >>= 64; mostSignificantBit += 64; }
      if (x >= 0x100000000) { x >>= 32; mostSignificantBit += 32; }
      if (x >= 0x10000) { x >>= 16; mostSignificantBit += 16; }
      if (x >= 0x100) { x >>= 8; mostSignificantBit += 8; }
      if (x >= 0x10) { x >>= 4; mostSignificantBit += 4; }
      if (x >= 0x4) { x >>= 2; mostSignificantBit += 2; }
      if (x >= 0x2) { mostSignificantBit += 1; }

      int256 result = (mostSignificantBit - 128) << 128;

      //determine fractional part
      x = uint256(int256(_logArg)) << uint256 (255 - mostSignificantBit) >> 128;
      for (int256 bit = 0x80000000000000000000000000000000; bit > 0; bit >>= 1) {
        x *= x;
        uint256 b = x >> 255;
        x >>= 127 + b;
        result += bit * int256(b);
      }

      return result;
    }
  }

  function lnQ128 (uint256 x) internal pure returns (int256) {
    int256 logTerm = log2Q128(x);
    if (logTerm > 0) {
      return int256(Math.mulDiv(uint256(logTerm), LnEQ128, SCALE));
    } else {
      return -1 * int256(Math.mulDiv(uint256(logTerm * -1), LnEQ128, SCALE));
    }
  }

  // all parameters are 128.128 fixed point numbers
  // (m - l * m) * x + d * m * Math.log(t / (t + x)) + p * x;
  function priceIntegral(
    uint256 d,
    uint256 a,
    uint256 m,//negative
    uint256 p,
    uint256 t,
    uint256 x
  ) private pure returns (uint256) {
    uint256 mSubAxMxX = (m - ((a * m) >> SHIFT)) * x;//-*+=negative
    uint256 term = (t << SHIFT) / (t + x);
    uint256 logTerm = uint256(lnQ128(term) * -1);//result will always be negative
    uint256 dXMxLogTerm = d * ((m * logTerm) >> SHIFT);
    uint256 pxX = p * x;//positive
    return (pxX + dXMxLogTerm - mSubAxMxX) >> SHIFT;
  }

  //returns a negative number
  function priceIntegralNegativeX(
    uint256 d,
    uint256 a,
    uint256 m,//negative
    uint256 p,
    uint256 t,
    uint256 x//negative
  ) private pure returns (uint256) {
    uint256 mSubAxMxX = (m - (a * m >> SHIFT)) * x;//positive
    uint256 logTerm = uint256(lnQ128((t << SHIFT) / (t - x)));//result will always be positive
    uint256 dXMxLogTerm = d * ((m * logTerm) >> SHIFT);//+*-*+=negative
    uint256 pxX = p * x;//negative
    return (pxX + dXMxLogTerm - mSubAxMxX) >> SHIFT;//negative
  }

  //price formula but with parameters more suitable for the internal functions
  function calcPriceCached(
    uint256 minuend,//positive
    uint256 numerator,//negative
    uint256 t,//positive
    uint256 x//positive
  ) private pure returns (uint256) {
    return minuend - (numerator / (t + x));
  }

  //price formula but with parameters more suitable for the internal functions
  function calcPriceNegativeXCached(
    uint256 minuend,//positive
    uint256 numerator,//negative
    uint256 t,//positive
    uint256 x//negative
  ) private pure returns (uint256) {
    return minuend + (numerator / (t - x));
  }

  function absoluteDiff(
    uint256 a,
    uint256 b
  ) private pure returns (uint256) {
    unchecked {
      if (a > b) {
        return a - b;
      } else {
        return b - a;
      }
    }
  }

  // all parameters are 128.128 fixed point numbers
  function solvePriceIntegralForXNewton(
    uint256 d,//reserves diff (total - specific)
    uint256 a,//tick bound allocation
    uint256 m,//tick slope
    uint256 p,//tick bound price
    uint256 t, //total reserves
    uint256 i//integral (delta reserves)
  ) private pure returns (uint256) {
    uint256 x = (i << SHIFT) / p;//starting estimate
    uint256 x_prev = type(uint256).max; //ensure that there is a big diff
    uint256 tolerance = uint256(i) / 1_000_000_000; // one millionth error tolerance
    
    //calc cached values of the price formula for later
    uint256 minuend = m - ((a * m) << SHIFT) + p;//positive
    uint256 numerator = d * m;//negative
    while (absoluteDiff(x, x_prev) > tolerance) {
      int256 f_x = int256(priceIntegral(d, a, m, p, t, x)) - int256(i);
      uint256 df_x = calcPriceCached(minuend, numerator, t, x);
      x_prev = x;
      x = uint256(int256(x) - (f_x << SHIFT) / int256(df_x));
    }
    return x;
  }

  function solvePriceIntegralForXNewtonNegativeI(
    uint256 d,//reserves diff (total - specific)
    uint256 a,//tick bound allocation
    uint256 m,//tick slope               NEGATIVE
    uint256 p,//tick bound price
    uint256 t, //total reserves
    uint256 i//integral (delta reserves) NEGATIVE
  ) private pure returns (uint256) {
    uint256 x = (i << SHIFT) / p;//starting estimate NEGATIVE
    uint256 x_prev = type(uint256).max; //ensure that there is a big diff NEGATIVE
    uint256 tolerance = uint256(i) / 1_000_000_000; // one millionth error tolerance
    
    //calc cached values of the price formula for later
    uint256 minuend = m - ((a * m) << SHIFT) + p;//positive
    uint256 numerator = d * m;//negative
    while (absoluteDiff(x, x_prev) > tolerance) {
      int256 f_x = int256(priceIntegralNegativeX(d, a, m, p, t, x)) - int256(i);
      uint256 df_x = calcPriceCached(minuend, numerator, t, x);
      x_prev = x;
      x = uint256(int256(x) - (f_x << SHIFT) / int256(df_x));
    }
    return x;
  }

  function calcStepMint(
    uint256 _depositAmount,
    uint256 _totalReserves,
    uint256 _specificReserves,
    TickData memory _tick
  ) internal pure returns (uint256 /*out*/, uint256 /*fee*/) {
    uint256 mintAmount = priceIntegral(
      _totalReserves - _specificReserves,
      uint256(_tick.allocation) << ALLOCATION_SHIFT,
      uint256(_tick.priceSlope) << PRICE_SLOPE_SHIFT,
      uint256(_tick.price) << PRICE_SHIFT,
      _totalReserves,
      _depositAmount
    );
    uint256 feeRateQ128 = uint256(_tick.increaseFee) << FEE_SHIFT;
    uint256 fee = (mintAmount * feeRateQ128) >> SHIFT;
    return (mintAmount - fee, fee);
  }

  function calcStepDeposit(
    uint256 _mintAmount,
    uint256 _totalReserves,
    uint256 _specificReserves,
    TickData memory _tick
  ) internal pure returns (uint256 /*in*/, uint256 /*fee*/) {
    uint256 feeRateQ128 = uint256(_tick.increaseFee) << FEE_SHIFT;
    uint256 fee = (_mintAmount * calcCompoundingFeeRate(feeRateQ128)) >> SHIFT;
    uint256 depositAmount = solvePriceIntegralForXNewton(
      _totalReserves - _specificReserves, 
      uint256(_tick.allocation) << ALLOCATION_SHIFT, 
      uint256(_tick.priceSlope) << PRICE_SLOPE_SHIFT, 
      uint256(_tick.price) << PRICE_SHIFT, 
      _totalReserves,
      _mintAmount + fee
    );
    return (uint256(depositAmount), fee);
  }

  function calcStepWithdrawal(
    uint256 _burnAmount,//negative
    uint256 _totalReserves,
    uint256 _specificReserves,
    TickData memory _tick
  ) internal pure returns (uint256 /*out*/, uint256 /*fee*/) {
    uint256 feeRateQ128 = uint256(_tick.decreaseFee) << FEE_SHIFT;
    uint256 fee = (_burnAmount * feeRateQ128) >> SHIFT;
    uint256 withdrawAmount = solvePriceIntegralForXNewtonNegativeI(
      _totalReserves - _specificReserves, 
      uint256(_tick.allocation) << ALLOCATION_SHIFT, 
      uint256(_tick.priceSlope) << PRICE_SLOPE_SHIFT, 
      uint256(_tick.price) << PRICE_SHIFT, 
      _totalReserves,
      _burnAmount - fee
    );
    return (uint256(withdrawAmount), fee);
  }

  function calcStepBurn(
    uint256 _withdrawAmount,//negative
    uint256 _totalReserves,
    uint256 _specificReserves,
    TickData memory _tick
  ) internal pure returns (uint256 /*in*/, uint256 /*fee*/) {
    uint256 burnAmount = priceIntegralNegativeX(
      _totalReserves - _specificReserves, 
      uint256(_tick.allocation) << ALLOCATION_SHIFT, 
      uint256(_tick.priceSlope) << PRICE_SLOPE_SHIFT, 
      uint256(_tick.price) << PRICE_SHIFT, 
      _totalReserves,
      _withdrawAmount
    );
    uint256 feeRateQ128 = uint256(_tick.decreaseFee) << FEE_SHIFT;
    
    /* 
      this calculation of the fee is technically wrong, because we have to burn more than the
      calculated amount to pay the fee. The true calculation involves adding the fee to the price formula
      which would significantly complicate things at this stage.
      The error is small enough that it is effectively the same in most situations,
      since it is at most, the fee of the fee.
    */
    uint256 fee = (burnAmount * calcCompoundingFeeRate(feeRateQ128)) >> SHIFT;
    return (burnAmount + fee, fee);
  }

  function computeMintGivenDeposit(
    AssetParams memory _assetParams,
    uint256 _depositAmountScaled,
    uint256 _specificReservesScaled,
    uint256 _totalReservesScaled
  ) public pure returns (uint256 mintAmount, uint256 fee) { //returns output amount
    uint256 depositAmountRemaining = _depositAmountScaled;
    uint256 stepTotalReserves = _totalReservesScaled;
    uint256 stepSpecificReserves = _specificReservesScaled;
    uint stepTickLowerBoundIndex = getTickLowerBoundIndex(
      _assetParams,
      stepSpecificReserves,
      stepTotalReserves
    );

    while (depositAmountRemaining != 0) {
      //calculate swap parameters
      TickData memory stepTick = _assetParams.tickData[stepTickLowerBoundIndex];
      //if this step would exceed the domain of the tick, set it to the maximum input within the tick
      uint256 maxDepositAmount = calcStepMaxDeposit(
        stepTick.nextAllocation, 
        stepSpecificReserves, 
        stepTotalReserves
      );
      uint256 stepDeposit = depositAmountRemaining > maxDepositAmount ? maxDepositAmount : depositAmountRemaining;
      //calculate swap
      (uint256 stepMintAmount, uint256 stepFee) = calcStepMint(
        stepDeposit, 
        stepTotalReserves, 
        stepSpecificReserves, 
        stepTick
      );
      fee += stepFee;
      //update step values
      mintAmount += stepMintAmount;
      depositAmountRemaining -= stepDeposit;
      stepSpecificReserves += stepDeposit;
      stepTotalReserves += stepDeposit;
      stepTickLowerBoundIndex++;
    }
  }

  function computeDepositGivenMint(
    AssetParams memory _assetParams,
    uint256 _mintAmount,
    uint256 _specificReservesScaled,
    uint256 _totalReservesScaled
  ) public pure returns (uint256 depositAmountScaled, uint256 fee) {
    uint256 mintAmountRemaining = _mintAmount;
    uint256 stepSpecificReserves = _specificReservesScaled;
    uint256 stepTotalReserves = _totalReservesScaled;
    uint stepTickLowerBoundIndex = getTickLowerBoundIndex(
      _assetParams, 
      _specificReservesScaled, 
      _totalReservesScaled
    );
    while (mintAmountRemaining != 0) {
      TickData memory stepTick = _assetParams.tickData[stepTickLowerBoundIndex];
      (uint256 stepDeposit, uint256 stepFee) = calcStepDeposit(
        mintAmountRemaining, 
        stepTotalReserves, 
        stepSpecificReserves, 
        stepTick
      );
      uint256 maxStepDeposit = calcStepMaxDeposit(stepTick.nextAllocation, stepSpecificReserves, stepTotalReserves);
      if (stepDeposit > maxStepDeposit) { // this input would exceed the domain of the current tick
        stepDeposit = maxStepDeposit;
        depositAmountScaled += stepDeposit;
        uint256 output;
        (output, stepFee) = calcStepMint(stepDeposit, stepTotalReserves, stepSpecificReserves, stepTick);
        fee += stepFee;
        mintAmountRemaining -= output;
        stepSpecificReserves += stepDeposit;
        stepTotalReserves += stepDeposit;
      } else { // all output was used within the current tick, update balances and return
        fee += stepFee;
        depositAmountScaled += stepDeposit;
        return (depositAmountScaled, fee);
      }
      stepTickLowerBoundIndex++;
    }
    revert("deposit exceeds allocation limit");
  }

  function computeWithdrawalGivenBurn(
    AssetParams memory _assetParams,
    uint256 _burnAmountScaled,
    uint256 _specificReservesScaled,
    uint256 _totalReservesScaled
  ) public pure returns (uint256 withdrawAmountScaled, uint256 fee) {
    uint256 burnAmountRemaining = _burnAmountScaled;
    uint256 stepSpecificReserves = _specificReservesScaled;
    uint256 stepTotalReserves = _totalReservesScaled;
    uint stepTickLowerBoundIndex = getTickLowerBoundIndex(
      _assetParams, 
      _specificReservesScaled,
      _totalReservesScaled
    );
    while (burnAmountRemaining != 0) {
      TickData memory stepTick = _assetParams.tickData[stepTickLowerBoundIndex];
      (uint256 stepWithdrawal, uint256 stepFee) = calcStepWithdrawal(burnAmountRemaining, stepTotalReserves, stepSpecificReserves, stepTick);
      uint256 maxStepWithdrawal = calcStepMaxWithdrawal(stepTick.allocation, stepSpecificReserves, stepTotalReserves);
      if (stepWithdrawal > maxStepWithdrawal) { // this withdrawal would exceed the domain of the current tick
        stepWithdrawal = maxStepWithdrawal;
        uint256 stepBurn;
        (stepBurn, stepFee) = calcStepBurn(stepWithdrawal, stepTotalReserves, stepSpecificReserves, stepTick);
        burnAmountRemaining -= stepBurn;
        fee += stepFee;
        withdrawAmountScaled += stepWithdrawal;
        stepSpecificReserves -= stepWithdrawal;
        stepTotalReserves -= stepWithdrawal;
        stepTickLowerBoundIndex--;
      } else { // all withdraw amount was used within the current tick, update balances and return
        withdrawAmountScaled += stepWithdrawal;
        fee += stepFee;
        return (withdrawAmountScaled, fee);
      }
    }
    
    revert("unfinished");
  }

  function computeBurnGivenWithdrawal(
    AssetParams memory _assetParams,
    uint256 _withdrawalAmountScaled,
    uint256 _specificReservesScaled,
    uint256 _totalReservesScaled
  ) public pure returns (uint256 burnAmount, uint256 fee) {
    uint256 withdrawalRemaining = _withdrawalAmountScaled;
    uint256 stepSpecificReserves = _specificReservesScaled;
    uint256 stepTotalReserves = _totalReservesScaled;
    uint stepTickLowerBoundIndex = getTickLowerBoundIndex(_assetParams, stepSpecificReserves, stepTotalReserves);
    while (true) {
      //calculate swap parameters
      TickData memory stepTick = _assetParams.tickData[stepTickLowerBoundIndex];

      //if this step would exceed the domain of the tick, set it to the maximum input within the tick
      uint256 maxWithdrawal = calcStepMaxWithdrawal(stepTick.allocation, stepSpecificReserves, stepTotalReserves);

      uint256 stepWithdrawal = withdrawalRemaining > maxWithdrawal ? maxWithdrawal : withdrawalRemaining;
      //calculate swap
      (uint256 stepBurn, uint256 stepFee) = calcStepBurn(
        stepWithdrawal, 
        stepTotalReserves, 
        stepSpecificReserves, 
        stepTick
      );
      
      //update step values
      burnAmount += stepBurn;
      fee += stepFee;
      withdrawalRemaining -= stepWithdrawal;
      stepSpecificReserves -= stepWithdrawal;
      stepTotalReserves -= stepWithdrawal;
      if (withdrawalRemaining == 0) {
        break;
      }
      stepTickLowerBoundIndex--;
    }
  }

  //swap between underlying assets
  function computeSwapUnderlyingGivenIn(
    AssetParams memory _inputAssetParams, 
    AssetParams memory _outputAssetParams,
    uint256 _inputAmountScaled,
    uint256 _inputReservesScaled,
    uint256 _outputReservesScaled,
    uint256 _totalReservesScaled
  ) external pure returns (uint256 /*outputAmount*/, uint256/*fee*/) {
    (uint256 mintAmount, uint256 fee0) = computeMintGivenDeposit(
      _inputAssetParams,
      _inputAmountScaled,
      _inputReservesScaled,
      _totalReservesScaled
    );

    (uint256 outputAmount, uint256 fee1) = computeWithdrawalGivenBurn(
      _outputAssetParams,
      mintAmount,
      _outputReservesScaled,
      _totalReservesScaled + _inputAmountScaled
    );

    return (outputAmount, fee0 + fee1);
  }

  function computeSwapUnderlyingGivenOut(
    AssetParams memory _inputAssetParams, 
    AssetParams memory _outputAssetParams,
    uint256 _outputAmountScaled,
    uint256 _inputReservesScaled,
    uint256 _outputReservesScaled,
    uint256 _totalReservesScaled
  ) external pure returns (uint256 /*inputAmount*/, uint256 /*fee*/) {
    (uint256 burnAmount, uint256 fee0) = computeBurnGivenWithdrawal(
      _outputAssetParams,
      _outputAmountScaled,
      _outputReservesScaled,
      _totalReservesScaled
    );

    (uint256 inputAmount, uint256 fee1) = computeDepositGivenMint(
      _inputAssetParams,
      burnAmount,
      _inputReservesScaled,
      _totalReservesScaled - _outputAmountScaled
    );

    return (inputAmount, fee0 + fee1);
  }
}