// SPDX-License-Identifier: MIT

pragma solidity ^0.8.27;

import "openzeppelin/contracts/token/ERC20/extensions/draft-IERC20Permit.sol";

interface IERC20MintAndBurn is IERC20Permit {
  function mint(address recipient, uint256 amount) external;
  function burnFrom(address burnAddress, uint256 amount) external;
  function decimals() external returns (uint8);
}