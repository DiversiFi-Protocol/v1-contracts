pragma solidity ^0.8.27;
import "./MintableERC20.sol";

contract MultiMinter {
    MintableERC20[] public mintableTokens;

    constructor(address[] memory _mintableTokens) {
      for (uint i = 0; i < _mintableTokens.length; i++) {
          mintableTokens.push(MintableERC20(_mintableTokens[i]));
      }
    }

    function mintAll(address _recipient, uint256 _amount) external {
      for (uint i = 0; i < mintableTokens.length; i++) {
          mintableTokens[i].mint(_recipient, _amount * mintableTokens[i].decimals());
      }
    }
}