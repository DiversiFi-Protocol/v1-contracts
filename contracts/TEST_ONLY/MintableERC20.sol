// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import "../ERC20.sol";

contract MintableERC20 is ERC20 {
  constructor(
    string memory _name, 
    string memory _symbol,
    uint8 _decimals
  ) ERC20(_name, _symbol) {
    _setupDecimals(_decimals);
  }

  function mint(address _recipient, uint256 _amount) external {
    _mint(_recipient, _amount);
  }
}