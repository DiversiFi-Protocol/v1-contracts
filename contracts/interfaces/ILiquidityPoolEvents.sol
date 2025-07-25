// SPDX-License-Identifier: BUSL-1.1

/**
 * @title DiversiFi - ILiquidityPoolAdmin.sol
 * @dev Licensed under Business Source License 1.1.
 *
 * You may not use this code in any production or competing service without
 * written permission from the licensor. The license changes to Apache 2.0
 * on January 1, 2028. See the LICENSE file for full details.
 */

pragma solidity ^0.8.27;

interface ILiquidityPoolEvents {
    // emitted when a user mints the index token directly in exchange
  // for depositing every asset in the pool at the same time
  // the updated scaled reserves of each asset are included in the scaledReserves array
  // the array is indexed by order of the ***********TARGETAssetParamsList_***********
  // NOTE THAT THIS ARRAY IS NOT NECESSARILY INDEXED IN THE SAME ORDER AS THE ARRAY EMITTED BY THE BURN() EVENT
  event Mint(
    address   indexed recipient,
    uint256   mintAmount,
    uint256[] scaledReserves,
    uint256   feesPaid
  );

  // emitted when a user burns the index token directly
  // to redeem every asset in the pool at the same time
  // the updated scaled reserves of each asset are included in the scaledReserves array
  // the array is indexed by order of the ***********CURRENTAssetParamsList_***********
  // NOTE THAT THIS ARRAY IS NOT NECESSARILY INDEXED IN THE SAME ORDER AS THE ARRAY EMITTED BY THE MINT() EVENT
  event Burn(
    address   indexed recipient,
    uint256   burnAmount,
    uint256[] scaledReserves,
    uint256   feesPaid
  );

  event Swap(
    address indexed asset,
    int256 deltaScaled, //the scaled change in reserves from the pool's perspective, positive is a deposit, negative is a withdrawal
    uint256 bountyPaid
  );

  //the entire remaining equalization bounty is paid out upon equalization
  event Equalization(
    int256[] deltasScaled //the change in reserves from the pool's perspective, positive is a deposit, negative is a withdrawal (ordered by currentAssetParamsList_)
  );

  event MintFeeChange(
    uint256 mintFeeQ96_
  );

  event BurnFeeChange(
    uint256 burnFeeQ96_
  );

  event TargetAssetParamsChange(
    address[] assetAddresses,
    uint88[] targetAllocations,
    uint8[] decimals
  );

  event IsMintEnabledChange(
    bool isMintEnabled
  );

  event MaxReservesChange(
    uint256 maxReserves,
    uint256 blockTime
  );

  event MaxReservesIncreaseCooldownChange(
    uint256 maxReservesIncreaseCooldown
  );

  event MaxReservesIncreaseRateChange(
    uint256 maxReservesIncreaseRateQ96_
  );

  event FeesCollected(
    uint256 feesCollected
  );

  event AdminChange(
    address admin
  );

  event EqualizationBountySet(
    uint256 equalizationBounty
  );
}