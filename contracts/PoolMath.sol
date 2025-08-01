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

import "hardhat/console.sol";


library PoolMath {
  uint256 constant SHIFT = 96; //shift a normal integer to get 96.96 fixed point
  uint256 constant ALLOCATION_FRAC_BITS = 88;
  uint256 constant ALLOCATION_SHIFT = SHIFT - ALLOCATION_FRAC_BITS; //shift 0.88 fixed point to get 96.96 fixed point
  uint256 constant SCALE = 2 ** SHIFT; //1 shifted by shift
  uint96 constant DEFAULT_BALANCE_MULTIPLIER = type(uint48).max;

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
  function calcCompoundingFeeRate(uint256 _feeRateQ96) internal pure returns (uint256) {
    return (_feeRateQ96 << SHIFT) / (SCALE - _feeRateQ96);
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

  /// @dev computes the balance multiplier required such that the total visible supply
  /// is backed 1:1 by the total reserves, if there is a surplus of reserves from the last balance multiplier.
  /// i.e. (the resulting balance multiplier is less than the last balance multiplier)
  /// the resulting balance multiplier will equal the last balance multiplier and the surplus is returned.
  /// if there is a deficit, the deficit is returned
  function computeFinalBalanceDivisorAndSurplus(
    uint256 totalReserves,
    uint256 baseTotalSupply,
    uint96 lastBalanceDivisor
  ) internal pure returns (uint96 balanceDivisor, int256 surplus /*(or deficit)*/) {
    /**
     * SANITY CHECKS:
     * it is practically impossible to end up in these situations to begin with, but
     * if we are here, the least catastrophic option is to just make the multiplier the max value.
     * (thereby lowering the balances of all token holders to practically zero.)
     * And setting the surplus to the max possible value, this will result in governance 
     * having effectively total control over the reserves, they can then oversee the proper
     * distribution of the reserves. 
     */
    if (totalReserves > baseTotalSupply || lastBalanceDivisor == 0) {
      return (type(uint96).max, int256(uint256(type(uint160).max)));
    }
    //END SANITY CHECKS

    surplus = int256(totalReserves) - int256(baseTotalSupply / uint256(lastBalanceDivisor));
    if (surplus >= 0) {
      console.log("positive surplus:", uint256(surplus));
      return (lastBalanceDivisor, surplus);
    } else {
      if (totalReserves == 0) {
        //if there are no reserves, then the total supply should be zero
        //since we get total supply by dividing baseTotalSupply by the balance multiplier,
        //we would need to set the balance multiplier to infinity to achieve this.
        //since there is no infinity, we just use the max possible value instead
        return (type(uint96).max, int256(baseTotalSupply / uint256(lastBalanceDivisor)));
      }
      console.log("negative surplus:", uint256(surplus * -1));
      //round the multiplier up
      return (uint96(baseTotalSupply / totalReserves) + 1, surplus);
    }
  }

  /// @dev computes the value of a Q96 number raised to the power of a normal integer number
  /// @param base a Q96 number
  /// @param exp a normal integer
  /// @return result the result of exponentiating base^exp
  function powQ96(uint256 base, uint256 exp) internal pure returns (uint256 result) {
    result = 1 << 96;
    while (exp > 0) {
      if (exp % 2 == 1) {
        result = (result * base) >> 96;
      }
      base = (base * base) >> 96;
      exp /= 2;
    }
  }
}