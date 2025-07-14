// SPDX-Liscense-Identifier: MIT

pragma solidity ^0.8.27;

interface ICodeProvider {
  /// @return returns the creation bytecode for the constract associated with this provider
  function getCreationBytecode() external pure returns (bytes memory);

  /// @dev deploys the contract whose bytecode is associated with this code provider
  /// @return returns the address of the newly created contract
  function deploy() external returns (address);
}