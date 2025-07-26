// SPDX-Liscense-Identifier: MIT

pragma solidity ^0.8.27;

import "../LiquidityPool.sol";

//returns the code required to deploy a specific contract (LiquidityPool)
contract CodeProviderV1 {
  address public constructorArg0;
  address public constructorArg1;

  constructor(address _constructorArg0, address _constructorArg1) {
    constructorArg0 = _constructorArg0;
    constructorArg1 = _constructorArg1;
  }

  function getCreationBytecode() public view returns (bytes memory) {
    return abi.encodePacked(
      // type(LiquidityPool).creationCode,
      abi.encode(constructorArg0, constructorArg1)
    );
  }

  function deploy() external returns (address) {
    bytes memory bytecode = getCreationBytecode();
    address deployed;

    assembly {
      deployed := create(0, add(bytecode, 0x20), mload(bytecode))
    }

    require(deployed != address(0), "Deployment failed");
    return deployed;
  }
}