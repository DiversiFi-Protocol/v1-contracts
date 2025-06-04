pragma solidity ^0.8.0;

contract Faucet {
  address public owner;

  constructor() {
      owner = msg.sender;
  }

  function withdraw(uint amount) public {
      require(msg.sender == owner, "Only the owner can withdraw");
      payable(owner).transfer(amount);
  }
}