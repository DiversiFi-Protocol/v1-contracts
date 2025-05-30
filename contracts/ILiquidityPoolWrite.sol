// SPDX-License-Identifier: BUSL-1.1

/**
 * @title DiversiFi - ILiquidityPoolWrite.sol
 * @dev Licensed under Business Source License 1.1.
 *
 * You may not use this code in any production or competing service without
 * written permission from the licensor. The license changes to Apache 2.0
 * on January 1, 2028. See the LICENSE file for full details.
 */

pragma solidity ^0.8.27;

import "./DataStructs.sol";

interface ILiquidityPoolWrite {
    // ~~~~~~~~~~~~~~~~~~~~~ Public Core Functions ~~~~~~~~~~~~~~~~~~~~~
    function mint(uint256 _mintAmount, address _recipient) external;
    function burn(uint256 _burnAmount) external;

    // ~~~~~~~~~~~~~~~~~~~~ Public Special Functions ~~~~~~~~~~~~~~~~~~~
    function swapTowardsTarget(address _asset, int256 _delta) external;
    function equalizeToTarget() external;
}