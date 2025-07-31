// SPDX-License-Identifier: MIT

pragma solidity ^0.8.27;

import "./OpenZeppelinTimelockController.sol";

/// @dev This contract enforces delays on specified governance or administrator actions

struct Delay {
  uint64 lastEdit;
  uint64 delay;
}

contract DFITimelockController is TimelockController {
  bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");

  uint64 public defaultDelay;
  uint64 public ethTransferDelay;
  mapping(bytes32 => Delay) public commandDelays;

  constructor(
    uint64 _defaultDelay,
    uint64 _ethTransferDelay,
    address[] memory proposers,
    address[] memory executors,
    address[] memory registrars
  ) TimelockController(0, proposers, executors) {
    defaultDelay = _defaultDelay;
    ethTransferDelay = _ethTransferDelay;
    _setRoleAdmin(REGISTRAR_ROLE, TIMELOCK_ADMIN_ROLE);
    for (uint i = 0; i < registrars.length; i++) {
      _setupRole(REGISTRAR_ROLE, registrars[i]);
    }
  }

  /***********************************************************************************
  *-----------------------------Overriden Functionality-------------------------------
  ***********************************************************************************/

  function schedule(
    address target,
    uint256 value,
    bytes calldata data,
    bytes32 predecessor,
    bytes32 salt,
    uint256 delay
  ) public override onlyRole(PROPOSER_ROLE) {
    require(delay >= getMinCommandDelay(target, data[4:], value), "DFITimelockController: insufficient delay");
    bytes32 id = hashOperation(target, value, data, predecessor, salt);
    _schedule(id, delay);
    emit CallScheduled(id, 0, target, value, data, predecessor, delay);
  }

  function scheduleBatch(
    address[] calldata targets,
    uint256[] calldata values,
    bytes[] calldata payloads,
    bytes32 predecessor,
    bytes32 salt,
    uint256 delay
  ) public override onlyRole(PROPOSER_ROLE) {
    require(targets.length == values.length, "DFITimelockController: length mismatch");
    require(targets.length == payloads.length, "DFITimelockController: length mismatch");
    require(delay >= getMaxMinCommandDelay(targets, payloads, values), "DFITimelockController: insufficient delay");

    bytes32 id = hashOperationBatch(targets, values, payloads, predecessor, salt);
    _schedule(id, delay);
    for (uint256 i = 0; i < targets.length; ++i) {
      emit CallScheduled(id, i, targets[i], values[i], payloads[i], predecessor, delay);
    }
  }

  /***********************************************************************************
  *------------------------------Unique Functionality---------------------------------
  ***********************************************************************************/

  /// @dev registers a command for a custom delay
  /// @param callAddress the address of the contract being called in this command
  /// @param functionSignature the function signature for the command being called
  /// @param delay the delay to execute the command once it is prepared
  function registerCommand(address callAddress, bytes4 functionSignature, uint64 delay) public onlyRole(REGISTRAR_ROLE) {
    commandDelays[getCommandSignature(callAddress, functionSignature)] = Delay({
      delay: delay,
      lastEdit: uint64(block.timestamp)
    });
  }

  function deRegisterCommand(bytes32 commandSignature) public onlyRole(REGISTRAR_ROLE) {
    delete(commandDelays[commandSignature]);
  }

  /// @dev returns highest minimum delay of a group of commands
  function getMaxMinCommandDelay(
    address[] calldata callAddresses, 
    bytes[] calldata callData,
    uint256[] calldata values
  ) private view returns (uint64 maxDelay) {
    for (uint i = 0; i < callData.length; i++) {
      uint64 iDelay = getMinCommandDelay(callAddresses[i], callData[i], values[i]);
      if (iDelay > maxDelay) { maxDelay = iDelay; }
    }
  }

  /// @dev returns the minimum delay before a command of this type can be executed
  function getMinCommandDelay(
    address callAddress, 
    bytes calldata callData,
    uint256 value
  ) private view returns (uint64 earliestExecutionTimestamp) {
    bytes4 functionSignature = bytes4(callData[4:]);
    Delay memory delay = commandDelays[getCommandSignature(callAddress, functionSignature)];
    uint64 highestDelay = 0;
    if (delay.lastEdit == 0) {// if this command has not been set, it gets the default delay  
      highestDelay = defaultDelay;
    }
    if (value != 0 && highestDelay < ethTransferDelay) { 
      highestDelay = ethTransferDelay;
    }

    //if the command was edited recently, it can't be executed until the default delay has passed
    uint64 earliestExecution = delay.lastEdit + defaultDelay;
    if (earliestExecution > uint64(block.timestamp)) {
      uint64 configDelay = earliestExecution - uint64(block.timestamp);
      if (configDelay > highestDelay) {
        highestDelay = configDelay;
      }
    }
    if (delay.delay > highestDelay) {
      highestDelay = delay.delay;
    }

    return highestDelay;
  }

  function getCommandSignature(address callAddress, bytes4 functionSignature) private pure returns (bytes32) {
    return keccak256(abi.encode(callAddress, functionSignature));
  }
}