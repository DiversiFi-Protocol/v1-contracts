// SPDX-Liscense-Identifier: MIT

pragma solidity ^0.8.27;

import "./LiquidityPool.sol";

//returns the code required to deploy a specific contract (LiquidityPool)
contract CodeProviderV1 {
  address public arg0;
  address public arg1;

  constructor(address _arg0, address _arg1) {
    arg0 = _arg0;
    arg1 = _arg1;
  }

  function getCreationBytecode() external pure returns (bytes memory) {
    return abi.encodePacked(
      type(LiquidityPool).creationCode,
      abi.encode(arg0, arg1)
    );
  }

  function deploy() external returns (address) {
    bytes memory bytecode = getBytecode();

    assembly {
      deployed := create(0, add(bytecode, 0x20), mload(bytecode))
    }

    require(deployed != address(0), "Deployment failed");
    return deployed;
  }
}