// SPDX-License-Identifier: MIT

pragma solidity ^0.8.27;

import "openzeppelin/contracts/token/ERC20/extensions/draft-IERC20Permit.sol";
import "openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IERC20MintAndBurn is IERC20Permit, IERC20 {
  function mint(address recipient, uint256 amount) external;
  function burnFrom(address burnAddress, uint256 amount) external;
  function burn(uint256 amount) external;
  function decimals() external view returns (uint8);
}