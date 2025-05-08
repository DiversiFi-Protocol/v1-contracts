// SPDX-License-Identifier: BUSL-1.1

/**
 * @title YourContractName
 * @dev Licensed under Business Source License 1.1.
 *
 * You may not use this code in any production or competing service without
 * written permission from the licensor. The license changes to Apache 2.0
 * on January 1, 2028. See the LICENSE file for full details.
 */


pragma solidity ^0.8.27;

import "openzeppelin/contracts/token/ERC20/ERC20.sol";
import "hardhat/console.sol";

contract LiquidityToken is ERC20 {
  address public backingPool;
  address public admin;

  modifier onlyBackingPool {
    // console.log("_msgSender()", _msgSender(), "backingPool:", backingPool);
    require(_msgSender() == backingPool, "only backing pool");
    _;
  }

  modifier onlyAdmin {
    require(_msgSender() == admin, "only admin");
    _;
  }

  constructor(
    string memory _name, 
    string memory _symbol,
    address _backingPool,
    address _admin
  ) ERC20(_name, _symbol) {
    backingPool = _backingPool;
    admin = _admin;
  }

  function setAdmin(address _admin) external onlyAdmin {
    admin = _admin;
  }

  function setBackingPool(address _backingPool) external onlyAdmin {
    backingPool = _backingPool;
  }

  function mint(address _recipient, uint256 _amount) external onlyBackingPool {
    _mint(_recipient, _amount);
  }

  function burnFrom(address _burnAddress, uint256 _amount) external onlyBackingPool {
    _burn(_burnAddress, _amount);
  }
}