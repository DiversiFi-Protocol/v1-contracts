require("@nomicfoundation/hardhat-toolbox");
require("hardhat-gas-reporter");
require("hardhat-contract-sizer");
require("hardhat-dependency-compiler");
require("@nomicfoundation/hardhat-verify");

const PRIVATE_KEY = process.env.PRIVATE_KEY;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
	sourcify: {
		enabled: true,
	},
	etherscan: {
		apiKey: process.env.ETHERSCAN_API_KEY,
	},
	solidity: {
		version: "0.8.27",
		settings: {
			optimizer: {
				enabled: true,
				runs: 1000000,
			},
		},
	},
	gasReporter: {
		enabled: true,
		currency: "USD",
		gasPrice: 5,
	},
	networks: {
		hardhat: {
			gas: 6_000_000,
		},
		mainnet: {
			url: "https://eth-mainnet.g.alchemy.com/v2/yHITndLemsVURB6z0335Y5aX3PHzRiXZ", // bravo labs deployer
			chainId: 1,
			accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
		},
		sepolia: {
			url: "https://eth-sepolia.g.alchemy.com/v2/yHITndLemsVURB6z0335Y5aX3PHzRiXZ", // bravo labs deployer
			chainId: 11155111,
			accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
		},
	},
	contractSizer: {
		runOnCompile: true,
		strict: true,
	},
	dependencyCompiler: {
    paths: [
      "@openzeppelin/contracts/governance/TimelockController.sol",
    ],
  },
};
