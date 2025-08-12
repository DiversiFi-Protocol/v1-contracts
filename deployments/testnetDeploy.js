const { ethers } = require("hardhat");
const { getCreateAddress, createPublicClient, http } = require("viem");
const { localhost } = require("viem/chains");
const chalk = require("chalk");
const utils = require("../test/testModules/utils.js");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("deployer address:", deployer.address)
  console.log("\n----------------------------------\n");
  const client = createPublicClient({
    chain: localhost,
    transport: http("http://127.0.0.1:8545"),
  });

  // Deploy MintableStableCoin Contracts
  console.log(chalk.cyan("Deploying MintableStableCoin tokens..."));
  const MintableStableCoin = await ethers.getContractFactory("MintableERC20");

  const token0Decimals = 18n
  const token0 = await MintableStableCoin.deploy(
    "Token0",
    "TK0",
    token0Decimals
  );
  await token0.waitForDeployment();
  console.log(`Token0 deployed to: ${await token0.getAddress()}`);

  const token1Decimals = 20n
  const token1 = await MintableStableCoin.deploy(
    "Token1",
    "TK1",
    token1Decimals
  );
  await token1.waitForDeployment();
  console.log(`Token1 deployed to: ${await token1.getAddress()}`);

  const token2Decimals = 6n  
  const token2 = await MintableStableCoin.deploy(
    "Token2",
    "TK2",
    token2Decimals
  );
  await token2.waitForDeployment();
  console.log(`Token2 deployed to: ${await token2.getAddress()}`);
  console.log("\n----------------------------------\n");

  const nonce = await client.getTransactionCount({
    address: await deployer.getAddress(),
  });
  const reserveManagerAddress = getCreateAddress({
    from: await deployer.getAddress(),
    nonce: nonce + 1,
  });

  // Deploy IndexToken Contract
  console.log(chalk.cyan("Deploying IndexToken contract..."));
  const IndexToken = await ethers.getContractFactory("IndexToken");
  const indexToken = await IndexToken.deploy(
    "Diversified USD",
    "DFiUSD",
    reserveManagerAddress,
    deployer.getAddress()
  );
  await indexToken.waitForDeployment();
  console.log(
    `IndexToken deployed to: ${await indexToken.getAddress()}`
  );

  console.log("\n----------------------------------\n");

  // Deploy reserveManager Contract
  console.log(chalk.cyan("Deploying ReserveManager contract..."));
  const ReserveManager = await ethers.getContractFactory("ReserveManager");
  const reserveManager = await ReserveManager.deploy(
    deployer.getAddress(),
    indexToken.getAddress(),
  );
  await reserveManager.waitForDeployment();
  const targetAllocation0 = utils.formatAllocationFromDecimal(0.4);
  const targetAllocation1 = utils.formatAllocationFromDecimal(0.35);
  const targetAllocation2 = utils.allocationRemainder([targetAllocation0, targetAllocation1]);
  await reserveManager.setTargetAssetParams(
    [
      {
        assetAddress: await token0.getAddress(),
        targetAllocation: targetAllocation0,
        decimals: token0Decimals
      },
      {
        assetAddress: await token1.getAddress(),
        targetAllocation: targetAllocation1,
        decimals: token1Decimals
      },
      {
        assetAddress: await token2.getAddress(),
        targetAllocation: targetAllocation2,
        decimals: token2Decimals
      }
    ]
  );
  await reserveManager.setIsMintEnabled(true);
  console.log(`ReserveManager deployed to: ${await reserveManager.getAddress()}`);
  console.log(
    chalk.yellow("Predicted ReserveManager address:"),
    reserveManagerAddress
  );
  console.log("\n----------------------------------\n");

  console.log(chalk.cyan("Minting Reserve Asset tokens..."));
  await token0.mint(
    await deployer.getAddress(),
    ethers.parseUnits("1000000", token0Decimals)
  );
  await token1.mint(
    await deployer.getAddress(),
    ethers.parseUnits("1000000", token1Decimals)
  );
  await token2.mint(
    await deployer.getAddress(),
    ethers.parseUnits("1000000", token2Decimals)
  );

  console.log("Token Balances:");
  console.log(
    "token0 balance:",
    (await token0.balanceOf(await deployer.getAddress())).toString(),
    "decimals:",
    token0Decimals
  );
  console.log(
    "token1 balance:",
    (await token1.balanceOf(await deployer.getAddress())).toString(),
    "decimals:",
    token1Decimals
  );
  console.log(
    "token2 balance:",
    (await token2.balanceOf(await deployer.getAddress())).toString(),
    "decimals:",
    token2Decimals
  );

  console.log(chalk.green("Tokens successfully minted"));

  console.log("\n----------------------------------\n");

  console.log(chalk.cyan("Minting base assets for Liquidity Pool"));
  await token0.approve(reserveManager.getAddress(), utils.MAX_UINT_256);
  await token1.approve(reserveManager.getAddress(), utils.MAX_UINT_256);
  await token2.approve(reserveManager.getAddress(), utils.MAX_UINT_256);
  await reserveManager.mint(
    ethers.parseUnits("100000", await indexToken.decimals()),
    "0x"
  );

  console.log(chalk.cyan("Final Balances:"));
  console.log(
    "token0 balance:      ",
    (await token0.balanceOf(await deployer.getAddress())).toString(),
    "decimals:",
    token0Decimals
  );
  console.log(
    "token1 balance:      ",
    (await token1.balanceOf(await deployer.getAddress())).toString(),
    "decimals:",
    token1Decimals
  );
  console.log(
    "token2 balance:      ",
    (await token2.balanceOf(await deployer.getAddress())).toString(),
    "decimals:",
    token2Decimals
  );
  console.log(
    "indexToken balance:",
    (await indexToken.balanceOf(await deployer.getAddress())).toString(),
    "decimals:",
    await indexToken.decimals()
  );

  console.log(chalk.green("Done"));

  console.log("\n----------------------------------\n");

  const multiMinterFactory = await ethers.getContractFactory("MultiMinter");
  const multiMinter = await multiMinterFactory.deploy([
    token0.getAddress(),
    token1.getAddress(),
    token2.getAddress(),
  ]);
  console.log("MultiMinter deployed to:", await multiMinter.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
