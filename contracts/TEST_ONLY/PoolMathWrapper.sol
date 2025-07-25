// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import "../PoolMath.sol";

contract PoolMathWrapper {

  function allocationToFixed(uint88 _allocation) public pure returns (uint256) {
    return PoolMath.allocationToFixed(_allocation);
  }

  function fixedToAllocation(uint256 _fixed) public pure returns (uint88) {
    return PoolMath.fixedToAllocation(_fixed);
  }

  function toFixed(uint256 _num) public pure returns (uint256) {
    return PoolMath.toFixed(_num);
  }

  function fromFixed(uint256 _num) public pure returns (uint256) {
    return PoolMath.fromFixed(_num);
  }

  function calcCompoundingFeeRate(uint256 _feeRateQ96) public pure returns (uint256) {
    return PoolMath.calcCompoundingFeeRate(_feeRateQ96);
  }

  //scale a token with specified decimals to be the same scale as _targetDecimals
  function scaleDecimals(uint256 _value, uint8 _currentScale, uint8 _targetScale) public pure returns (uint256) {
    return PoolMath.scaleDecimals(
        _value,
        _currentScale,
        _targetScale
    );
  }

  function calcMaxIndividualDelta(    
    uint88 _targetAllocation,
    uint256 _specificReserves,
    uint256 _totalReserves
  ) public pure returns (int256) {
    return PoolMath.calcMaxIndividualDelta(
      _targetAllocation,
      _specificReserves,
      _totalReserves
    );
  }

  function calcEqualizationBounty(
    uint256 _totalEqualizationBounty,
    uint256 _discrepencyBefore,
    uint256 _discrepencyAfter
  ) public pure returns (uint256 bounty) {
    return PoolMath.calcEqualizationBounty(
      _totalEqualizationBounty,
      _discrepencyBefore,
      _discrepencyAfter
    );
  }

}