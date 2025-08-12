// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import "../ReserveMath.sol";

contract ReserveMathWrapper {

  function allocationToFixed(uint88 _allocation) public pure returns (uint256) {
    return ReserveMath.allocationToFixed(_allocation);
  }

  function fixedToAllocation(uint256 _fixed) public pure returns (uint88) {
    return ReserveMath.fixedToAllocation(_fixed);
  }

  function toFixed(uint256 _num) public pure returns (uint256) {
    return ReserveMath.toFixed(_num);
  }

  function fromFixed(uint256 _num) public pure returns (uint256) {
    return ReserveMath.fromFixed(_num);
  }

  function calcCompoundingFeeRate(uint256 _feeRateQ96) public pure returns (uint256) {
    return ReserveMath.calcCompoundingFeeRate(_feeRateQ96);
  }

  //scale a token with specified decimals to be the same scale as _targetDecimals
  function scaleDecimals(uint256 _value, uint8 _currentScale, uint8 _targetScale) public pure returns (uint256) {
    return ReserveMath.scaleDecimals(
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
    return ReserveMath.calcMaxIndividualDelta(
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
    return ReserveMath.calcEqualizationBounty(
      _totalEqualizationBounty,
      _discrepencyBefore,
      _discrepencyAfter
    );
  }

}