require("dotenv").config();
require("@nomicfoundation/hardhat-toolbox");
require("hardhat-gas-reporter");
require("hardhat-contract-sizer");
require("hardhat-dependency-compiler");
require("@nomicfoundation/hardhat-verify");
const { extendEnvironment } = require("hardhat/config");
const { HardhatPluginError } = require("hardhat/plugins");

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const MNEMONIC = process.env.MNEMONIC;
const networkAccounts = PRIVATE_KEY
	? [PRIVATE_KEY]
	: MNEMONIC
	? { mnemonic: MNEMONIC }
	: [];

// The remote networks reach Ethereum through Alchemy; the key comes from .env, never from this file.
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY ?? "";
const ALCHEMY_NETWORK_NAMES = ["mainnet", "sepolia"];

// Local work (compile, test, the hardhat network) needs no key, so fail only once an Alchemy network is selected.
extendEnvironment((hre) => {
	if (ALCHEMY_NETWORK_NAMES.includes(hre.network.name) && ALCHEMY_API_KEY === "") {
		throw new HardhatPluginError(
			"hardhat.config.js",
			`ALCHEMY_API_KEY is not set, but network "${hre.network.name}" needs it. Copy .env.example to .env and fill in ALCHEMY_API_KEY.`
		);
	}
});

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
			url: `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
			chainId: 1,
			accounts: networkAccounts,
		},
		sepolia: {
			url: `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
			chainId: 11155111,
			accounts: networkAccounts,
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
