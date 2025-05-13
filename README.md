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

## License

This code is licensed under the Business Source License 1.1. See the [LICENSE](./LICENSE) file for details.
