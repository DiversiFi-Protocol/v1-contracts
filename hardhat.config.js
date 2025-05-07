require("@nomicfoundation/hardhat-toolbox");
require("hardhat-gas-reporter")
require("hardhat-contract-sizer");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.27",
    settings: {
      optimizer: {
        enabled: true,
        runs: 100000,
      },
    },
  },
  gasReporter: {
    enabled: false,
    currency: "USD",
    gasPrice: 5,
  },
  networks: {
    hardhat: {
      gas: 6_000_000,
    }
  },
  contractSizer: {
    runOnCompile: true,
    strict: true,
  },
};

