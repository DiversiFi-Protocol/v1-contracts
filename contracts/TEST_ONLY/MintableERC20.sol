// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import "openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MintableERC20 is ERC20 {
  uint8 private immutable decimals_;
  constructor(
    string memory _name, 
    string memory _symbol,
    uint8 _decimals
  ) ERC20(_name, _symbol) {
    decimals_ = _decimals;
  }

  function decimals() public view virtual override returns (uint8) {
    return decimals_;
  }

  function mint(address _recipient, uint256 _amount) external {
    _mint(_recipient, _amount);
  }
}