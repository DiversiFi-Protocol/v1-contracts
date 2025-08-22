require("@nomicfoundation/hardhat-toolbox");
require("hardhat-gas-reporter");
require("hardhat-contract-sizer");
require("@nomicfoundation/hardhat-verify");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
	sourcify: {
		enabled: true,
	},
	etherscan: {
		apiKey: process.env.ETHERSCAN_API_KEY, // or put your key directly (not recommended)
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
			accounts: {
				mnemonic: typeof process.env.MNEMONIC === "undefined" ? "test test test test test test test test test test test junk" : process.env.MNEMONIC,
				path: "m/420'/69'/0'/0",
				initialIndex: 0,
				count: 20,
				passphrase: "",
			},
		},
		sepolia: {
			url: "https://eth-sepolia.g.alchemy.com/v2/yHITndLemsVURB6z0335Y5aX3PHzRiXZ", // bravo labs deployer
			chainId: 11155111,
			accounts: {
				mnemonic: typeof process.env.MNEMONIC === "undefined" ? "test test test test test test test test test test test junk" : process.env.MNEMONIC,
				path: "m/420'/69'/0'/0",
				initialIndex: 0,
				count: 20,
				passphrase: "",
			},
		},
	},
	contractSizer: {
		runOnCompile: true,
		strict: true,
	},
};
