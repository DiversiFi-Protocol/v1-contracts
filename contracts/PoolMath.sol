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
  uint256 constant ALLOCATION_SHIFT = SHIFT - 32; //shift 0.32 fixed point to get 128.128 fixed point
  uint256 constant SCALE = 2 ** SHIFT; //1 shifted by shift

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
}