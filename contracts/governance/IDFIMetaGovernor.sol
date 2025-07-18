// SPDX-Liscense-Identifier: MIT

pragma solidity ^0.8.27;

/// @dev This contract *governs* what governance or an administrator is
/// allowed to do and enforces delays on certain actions. All of these functions,
/// (except execute()), don't actually do anything, but rather add an action to a 
/// map of prepared-immmature commands. After the maturation period has passed, the
/// commands can executed via a call to execute()
interface MetaGovernor {
  /// @dev Upgrades this contract to a new implementation
  /// @param newImplementation The address of the aldready deployed new implementation
  function upgrade(address newImplementation) external;

  /// @dev Executes the command corresponding to the relavant command hash
  /// @param commandHash A hash for looking up a prepared-mature command.
  function execute(bytes calldata commandHash) external;
}