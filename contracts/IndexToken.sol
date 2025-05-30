// SPDX-License-Identifier: BUSL-1.1

/**
 * @title DiversiFi - IndexToken
 * @dev Licensed under Business Source License 1.1.
 *
 * You may not use this code in any production or competing service without
 * written permission from the licensor. The license changes to Apache 2.0
 * on January 1, 2028. See the LICENSE file for full details.
 */


pragma solidity ^0.8.27;

import "openzeppelin/contracts/token/ERC20/ERC20.sol";

contract IndexToken is ERC20 {
  address public liquidityPool;
  address public admin;

  modifier onlyLiquidityPool {
    require(_msgSender() == liquidityPool, "only liquidity pool");
    _;
  }

  modifier onlyAdmin {
    require(_msgSender() == admin, "only admin");
    _;
  }

  constructor(
    string memory _name, 
    string memory _symbol,
    address _liquidityPool,
    address _admin
  ) ERC20(_name, _symbol) {
    liquidityPool = _liquidityPool;
    admin = _admin;
  }

  function setAdmin(address _admin) external onlyAdmin {
    admin = _admin;
  }

  function setLiquidityPool(address _liquidityPool) external onlyAdmin {
    liquidityPool = _liquidityPool;
  }

  function mint(address _recipient, uint256 _amount) external onlyLiquidityPool {
    _mint(_recipient, _amount);
  }

  function burnFrom(address _burnAddress, uint256 _amount) external onlyLiquidityPool {
    _burn(_burnAddress, _amount);
  }
}