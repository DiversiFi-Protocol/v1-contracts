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


library PoolMath {
  uint256 constant SHIFT = 128; //shift a normal integer to get 128.128 fixed point
  uint256 constant ALLOCATION_FRAC_BITS = 88;
  uint256 constant ALLOCATION_SHIFT = SHIFT - ALLOCATION_FRAC_BITS; //shift 0.88 fixed point to get 128.128 fixed point
  uint256 constant SCALE = 2 ** SHIFT; //1 shifted by shift

  //scale a token with specified decimals to be the same scale as _targetDecimals
  function scaleDecimals(uint256 _value, uint8 _currentScale, uint8 _targetScale) internal pure returns (uint256) {
    if (_currentScale == _targetScale) {
      return _value;
    } else if (_currentScale < _targetScale) {
      return _value * uint256(10 ** (_targetScale - _currentScale));
    } else {
      return _value / uint256(10 ** (_currentScale - _targetScale));
    }
  }

  function allocationToFixed(uint88 _allocation) internal pure returns (uint256) {
    return uint256(_allocation) << ALLOCATION_SHIFT;
  }

  function fixedToAllocation(uint256 _fixed) internal pure returns (uint88) {
    return uint88(_fixed >> ALLOCATION_SHIFT);
  }

  function toFixed(uint256 _num) internal pure returns (uint256) {
    return _num << SHIFT;
  }

  function fromFixed(uint256 _num) internal pure returns (uint256) {
    return _num >> SHIFT;
  }

  /*
    NOTES: slight rounding errors are present in this function, it should
    not be expected to return the delta required to move an allocation firmly into
    the next tick, although we are effectively only off by at most 2e^-18.
    We should simply behave as if we are in the next tick after depositing this amount.
    Because these amounts are so small it has been determined that correcting them would
    be a waste of gas.
  */
  function calcMaxIndividualDelta(
    uint88 _targetAllocation,
    uint256 _specificReserves,
    uint256 _totalReserves
  ) internal pure returns (int256) {
    require(_targetAllocation != type(uint88).max, "max allocation is 100%, use mint()/burn() instead");
    uint256 normalizedTargetAllocation = uint256(_targetAllocation) << ALLOCATION_SHIFT;
    uint256 targetReserves = (normalizedTargetAllocation * _totalReserves) >> SHIFT;

    int256 numerator = (int256(targetReserves) - int256(_specificReserves)) << SHIFT;
    int256 denominator = int256(SCALE) - int256(normalizedTargetAllocation);

    return numerator / denominator;
  }

  //calculates the equivalent fee rate when you need to take a
  //fee of a fee of a fee .... to infinity
  function calcCompoundingFeeRate(uint256 _feeRateQ128) internal pure returns (uint256) {
    return (_feeRateQ128 << SHIFT) / (SCALE - _feeRateQ128);
  }

  /// @dev calculates the equalization bounty for a given amount contributed towards equalization
  function calcEqualizationBounty(
    uint256 _totalEqualizationBounty,
    uint256 _discrepencyBefore,
    uint256 _discrepencyAfter
  ) internal pure returns (uint256 bounty) {
    if(_totalEqualizationBounty == 0) {
      return 0; //no bounty set
    }
    uint256 resolvedDiscrepency = _discrepencyBefore - _discrepencyAfter;

    //resolvedDiscrepency * (bounty/discrepency)
    return _totalEqualizationBounty * resolvedDiscrepency / _discrepencyBefore;
  }
}