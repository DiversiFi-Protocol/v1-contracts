# Contracts-v1

Smart Contracts and test scripts

## Pre-requisites

- [nvm (Node Version Manager)](https://github.com/nvm-sh/nvm) installed
- Node.js version specified in `.nvmrc`
- `nvm use`
- Install node_modules with `npm install`

## Development

### Starting a Development Server

- `npm run start` to start the Hardhat node
- `npm run deploy-local` to deploy contracts and mint tokens

### Generating an ABI file

- `npm run compile` will generate an ABI file in `/artifacts/contracts/${contract}.sol/${contract}.json`

### Connecting to mainnet and sepolia

The `mainnet` and `sepolia` networks connect through Alchemy.
Copy `.env.example` to `.env` (which git ignores) and set `ALCHEMY_API_KEY` to your Alchemy API key.
Deploying also needs `PRIVATE_KEY` or `MNEMONIC` for the deployer account, and verifying needs `ETHERSCAN_API_KEY`.
Compiling, testing and the local Hardhat network work without any of these.
Selecting `--network mainnet` or `--network sepolia` without `ALCHEMY_API_KEY` stops with an error that names the missing variable.

## License

This code is licensed under the Business Source License 1.1. See the [LICENSE](./LICENSE) file for details.
