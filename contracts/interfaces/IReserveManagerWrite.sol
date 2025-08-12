// SPDX-License-Identifier: BUSL-1.1

/**
 * @title DiversiFi - IReserveManagerWrite.sol
 * @dev Licensed under Business Source License 1.1.
 *
 * You may not use this code in any production or competing service without
 * written permission from the licensor. The license changes to Apache 2.0
 * on January 1, 2028. See the LICENSE file for full details.
 */

pragma solidity ^0.8.27;

import "../DataStructs.sol";

interface IReserveManagerWrite {
    // ~~~~~~~~~~~~~~~~~~~~~ Public Core Functions ~~~~~~~~~~~~~~~~~~~~~

    /** 
     * @dev transferres all underlying tokens from the caller's account to the pool in exchange for
     * newly minted index tokens. The caller must call ERC20.approve() for this contract for all underlying
     * tokens that will be transferred. Transfers according to the TARGET allocation of each asset
     * @param mintAmount the amount of tokens to be minted - in atomic units
     * @param forwardData (optional) data that will be forwarded to the caller for flash mint functionality.
     * Caller must implement IReserveManagerCallback for this to work. see IReserveManagerCallback for details.
     * This parameter can be ignored by passing in an empty value
     * @return inputAmounts an array of assets and amounts required to mint the desired amount of tokens
     */
    function mint(uint256 mintAmount, bytes calldata forwardData) external returns (AssetAmount[] memory inputAmounts);

    /** 
     * @dev burns index tokens from the callers account and transferres underlying tokens from the pool to
     * the caller. No approvals are needed to call this function.
     *  Transfers according to the Current allocation of each asset
     * @param burnAmount the amount of tokens to be burned - in atomic units
     * @param forwardData (optional) data that will be forwarded to the caller for flash mint functionality.
     * Caller must implement IReserveManagerCallback for this to work. see IReserveManagerCallback for details.
     * This parameter can be ignored by passing in an empty value
     * @return outputAmounts an array of assets and amounts returned for burning the desired amount of tokens
     */
    function burn(uint256 burnAmount, bytes calldata forwardData) external returns (AssetAmount[] memory outputAmounts);

    // ~~~~~~~~~~~~~~~~~~~~ Public Special Functions ~~~~~~~~~~~~~~~~~~~
    /** 
     * @dev Swaps a reserve asset for index tokens. Only available when the reserve asset's current allocation differs from
     * its target allocation. Swaps are only allowed if they result in the relavant asset's current allocation being closer
     * to its target allocation. Also applies an equalization bounty to as a discount/premium to the swap if one is set.
     * ERC20.approve() must be called for the asset being swapped.
     * Fails if the output asset is the index token and the pool is migrating.
     * @param asset the reserve asset that is being swapped for index tokens
     * @param delta the delta of the reserves of the reserve asset being swapped. (positive means deposit, negative means withdraw)
     * @return reserveTransfer the amount of reserves  transferred to/from the pool depending on the sign of delta
     * @return indexTransfer the amount of index tokens minted/burned to/from the caller depending on the sign of delta
     */
    function swapTowardsTarget(address asset, int256 delta) external returns (uint256 reserveTransfer, uint256 indexTransfer);

    /** 
     * @dev Applies the equalization vector to the pool via exchange with the caller's account. 
     * See IReserveManagerGetters.getEqualizationVector(), or the whitepaper v1 for more details.
     * Successfully calling this function always results in the pool being equalized.
     * Transferres the remaining equalization bounty to the caller if successful.
     * ERC20.approve() must be called for all target reserve assets in the pool.
     * @return actualDeltas the actual deltas of each token in the tokens native decimal scale, the list is sorted by order in currentAssetParams
     */
    function equalizeToTarget() external returns (int256[] memory actualDeltas);

    /**
     * @dev Withdraws everything from the pool and burns equivalent index tokens from the caller.
     * Useful for removing dust accumulated from rounding errors when finishing a pool migration.
     * Because there can be no reserves in the pool when the migration finishes.
     * @return outputAmounts the token amounts that are withdrawn
     */
    function withdrawAll() external returns (AssetAmount[] memory outputAmounts);
}