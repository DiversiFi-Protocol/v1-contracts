const { ethers } = require("hardhat");
const { getCreateAddress, createPublicClient, http } = require("viem");
const { localhost } = require("viem/chains");
const chalk = require("chalk");
const utils = require("../test/testModules/utils.js");

async function main() {
  const [deployer] = await ethers.getSigners();
  const client = createPublicClient({
    chain: localhost,
    transport: http("http://127.0.0.1:8545"),
  });

  // Deploy MintableStableCoin Contracts
  console.log(chalk.cyan("Deploying MintableStableCoin tokens..."));
  const MintableStableCoin = await ethers.getContractFactory("MintableERC20");
  const PoolMathLibraryFactory = await ethers.getContractFactory("PoolMath");

  const token0 = await MintableStableCoin.deploy(
    "Token0",
    "TK0",
    assetParams0.decimals
  );
  await token0.waitForDeployment();
  console.log(`Token0 deployed to: ${await token0.getAddress()}`);

  const token1 = await MintableStableCoin.deploy(
    "Token1",
    "TK1",
    assetParams1.decimals
  );
  await token1.waitForDeployment();
  console.log(`Token1 deployed to: ${await token1.getAddress()}`);

  const token2 = await MintableStableCoin.deploy(
    "Token2",
    "TK2",
    assetParams2.decimals
  );
  await token2.waitForDeployment();
  console.log(`Token2 deployed to: ${await token2.getAddress()}`);
  console.log("\n----------------------------------\n");

  const PoolMathLibary = await PoolMathLibraryFactory.deploy();
  await PoolMathLibary.waitForDeployment();

  const nonce = await client.getTransactionCount({
    address: await deployer.getAddress(),
  });
  const liquidityPoolAddress = getCreateAddress({
    from: await deployer.getAddress(),
    nonce: nonce + 1,
  });

  // Deploy LiquidityToken Contract
  console.log(chalk.cyan("Deploying LiquidityToken contract..."));
  const LiquidityToken = await ethers.getContractFactory("LiquidityToken");
  const liquidityToken = await LiquidityToken.deploy(
    "Diversified USD",
    "USD1",
    liquidityPoolAddress,
    deployer.getAddress()
  );
  await liquidityToken.waitForDeployment();
  console.log(
    `LiquidityToken deployed to: ${await liquidityToken.getAddress()}`
  );

  console.log("\n----------------------------------\n");

  // Deploy liquidityPool Contract
  console.log(chalk.cyan("Deploying LiquidityPool contract..."));
  const LiquidityPool = await ethers.getContractFactory("LiquidityPool", {
    libraries: {
      PoolMath: PoolMathLibary.target,
    },
  });
  const liquidityPool = await LiquidityPool.deploy(
    deployer.getAddress(),
    liquidityToken.getAddress(),
    ethers.MaxUint256,
    utils.decimalToFixed(0.1)
  );
  await liquidityPool.waitForDeployment();
  await liquidityPool.setAssetParams(
    [token0.getAddress(), token1.getAddress(), token2.getAddress()],
    [assetParams0, assetParams1, assetParams2]
  );
  await liquidityPool.setIsDirectMintEnabled(true);
  await liquidityPool.setIsSwapEnabled(true);
  console.log(`LiquidityPool deployed to: ${await liquidityPool.getAddress()}`);
  console.log(
    chalk.yellow("Predicted LiquidityPool address:"),
    liquidityPoolAddress
  );
  console.log("\n----------------------------------\n");

  console.log(chalk.cyan("Minting Reserve Asset tokens..."));
  await token0.mint(
    await deployer.getAddress(),
    ethers.parseUnits("1000000", assetParams0.decimals)
  );
  await token1.mint(
    await deployer.getAddress(),
    ethers.parseUnits("1000000", assetParams1.decimals)
  );
  await token2.mint(
    await deployer.getAddress(),
    ethers.parseUnits("1000000", assetParams2.decimals)
  );

  console.log("Token Balances:");
  console.log(
    "token0 balance:",
    (await token0.balanceOf(await deployer.getAddress())).toString(),
    "decimals:",
    assetParams0.decimals
  );
  console.log(
    "token1 balance:",
    (await token1.balanceOf(await deployer.getAddress())).toString(),
    "decimals:",
    assetParams1.decimals
  );
  console.log(
    "token2 balance:",
    (await token2.balanceOf(await deployer.getAddress())).toString(),
    "decimals:",
    assetParams2.decimals
  );

  console.log(chalk.green("Tokens successfully minted"));

  console.log("\n----------------------------------\n");

  console.log(chalk.cyan("Minting base assets for Liquidity Pool"));
  await token0.approve(liquidityPool.getAddress(), utils.MAX_UINT_256);
  await token1.approve(liquidityPool.getAddress(), utils.MAX_UINT_256);
  await token2.approve(liquidityPool.getAddress(), utils.MAX_UINT_256);
  await liquidityPool.mint(
    ethers.parseUnits("100000", await liquidityToken.decimals()),
    await deployer.getAddress()
  );

  console.log(chalk.cyan("Final Balances:"));
  console.log(
    "token0 balance:      ",
    (await token0.balanceOf(await deployer.getAddress())).toString(),
    "decimals:",
    assetParams0.decimals
  );
  console.log(
    "token1 balance:      ",
    (await token1.balanceOf(await deployer.getAddress())).toString(),
    "decimals:",
    assetParams1.decimals
  );
  console.log(
    "token2 balance:      ",
    (await token2.balanceOf(await deployer.getAddress())).toString(),
    "decimals:",
    assetParams2.decimals
  );
  console.log(
    "liquidityToken balance:",
    (await liquidityToken.balanceOf(await deployer.getAddress())).toString(),
    "decimals:",
    await liquidityToken.decimals()
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
