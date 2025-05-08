const { ethers } = require("hardhat");
const {
  assetParams0, 
  assetParams1, 
  assetParams2,
} = require("./assetParams.js");
const { getCreateAddress, createPublicClient, http } = require('viem');
const { localhost } = require('viem/chains');
const utils = require("../test/testModules/utils.js")

async function main() {
  const [deployer] = await ethers.getSigners();
  const client = createPublicClient({
    chain: localhost,
    transport: http('http://127.0.0.1:8545'),
  });

  // Deploy MintableStableCoin Contracts
  console.log("Deploying MintableStableCoin tokens...");
  const MintableStableCoin = await ethers.getContractFactory("MintableERC20");
  const PoolMathLibraryFactory = await ethers.getContractFactory("PoolMath");


  const token0 = await MintableStableCoin.deploy("Token0", "TK0", assetParams0.decimals);
  await token0.waitForDeployment()
  console.log(`Token1 deployed to: ${await token0.getAddress()}`);

  const token1 = await MintableStableCoin.deploy("Token1", "TK1", assetParams1.decimals);
  await token1.waitForDeployment();
  console.log(`Token2 deployed to: ${await token1.getAddress()}`);

  const token2 = await MintableStableCoin.deploy("Token2", "TK2", assetParams2.decimals);
  await token2.waitForDeployment();
  console.log(`Token3 deployed to: ${await token2.getAddress()}`);

  const PoolMathLibary = await PoolMathLibraryFactory.deploy();
  await PoolMathLibary.waitForDeployment();

  const nonce = await client.getTransactionCount({ address: await deployer.getAddress() });
  const liquidityPoolAddress = getCreateAddress({
    from: await deployer.getAddress(),
    nonce: nonce + 1,
  });

  // Deploy LiquidityToken Contract
  console.log("Deploying LiquidityToken contract...");
  const LiquidityToken = await ethers.getContractFactory("LiquidityToken");
  const liquidityToken = await LiquidityToken.deploy("Diversified USD", "USD1", liquidityPoolAddress, deployer.getAddress());
  await liquidityToken.waitForDeployment();
  console.log(`LiquidityToken deployed to: ${await liquidityToken.getAddress()}`);

  // Deploy liquidityPool Contract
  console.log("Deploying liquidityPool contract...");
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
  await liquidityPool.setIsSwapEnabled(true)
  console.log(`LiquidityPool deployed to: ${await liquidityPool.getAddress()}`);
  console.log("predicted liquidityPool address:", liquidityPoolAddress);

  console.log("minting tokens...")
  await token0.mint(await deployer.getAddress(), ethers.parseUnits("1000000", assetParams0.decimals));
  await token1.mint(await deployer.getAddress(), ethers.parseUnits("1000000", assetParams1.decimals));
  await token2.mint(await deployer.getAddress(), ethers.parseUnits("1000000", assetParams2.decimals));
  console.log("tokens minted")
  console.log("balances:")
  console.log("token0 balance:", (await token0.balanceOf(await deployer.getAddress())).toString(), "token0 decimals:", assetParams0.decimals);
  console.log("token1 balance:", (await token1.balanceOf(await deployer.getAddress())).toString(), "token1 decimals:", assetParams1.decimals);
  console.log("token2 balance:", (await token2.balanceOf(await deployer.getAddress())).toString(), "token2 decimals:", assetParams2.decimals);


  console.log("minting base assets for liquidity pool")
  await token0.approve(liquidityPool.getAddress(), utils.MAX_UINT_256);
  await token1.approve(liquidityPool.getAddress(), utils.MAX_UINT_256);
  await token2.approve(liquidityPool.getAddress(), utils.MAX_UINT_256);
  await liquidityPool.mint(ethers.parseUnits("100000", await liquidityToken.decimals()), await deployer.getAddress())
  console.log("done")

  console.log("final balances:")
  console.log("token0 balance:      ", (await token0.balanceOf(await deployer.getAddress())).toString(), "token0 decimals:", assetParams0.decimals);
  console.log("token1 balance:      ", (await token1.balanceOf(await deployer.getAddress())).toString(), "token1 decimals:", assetParams1.decimals);
  console.log("token32balance:      ", (await token2.balanceOf(await deployer.getAddress())).toString(), "token2 decimals:", assetParams2.decimals);
  console.log("liquidity token balance:", (await liquidityToken.balanceOf(await deployer.getAddress())).toString(), "liquidity token decimals:", await liquidityToken.decimals());

  const multiMinterFactory = await ethers.getContractFactory("MultiMinter");
  const multiMinter = await multiMinterFactory.deploy([token0.getAddress(), token1.getAddress(), token2.getAddress()]);
  console.log("MultiMinter deployed to:", await multiMinter.getAddress())
}

main()
.then(() => process.exit(0))
.catch((error) => {
  console.error(error);
  process.exit(1);
});