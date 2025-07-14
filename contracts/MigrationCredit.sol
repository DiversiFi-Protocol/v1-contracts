// SPDX-Liscense-Identifier: MIT

pragma solidity ^0.8.27;

import "openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MirationCredit is ERC20 {
  address public issuer;
  address public consumer;

  constructor() ERC20("")

  modifier onlyIssuer {
    require(_msgSender() == issuer, "only issuer");
    _;
  }

  modifier onlyConsumer {
    require(_msgSender() == consumer, "only consumer");
  }
}