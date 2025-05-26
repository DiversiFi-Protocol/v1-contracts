const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const hre = require("hardhat");
const { getAddress, parseGwei, getCreateAddress, maxUint16 } = require("ethers");
const utils = require("../testModules/utils.js");
const { expect } = require("chai")
const { assetParams0, assetParams1, assetParams2 } = require("../../deployments/assetParams.js");

describe("LiquidityPool - Getters", function () {
  async function deployAll() {
    const tokenName = "Diversified USD";
    const tokenSymbol = "USD1";
    const [admin, unpriviledged] = await hre.ethers.getSigners();
    const liquidityPoolAddress = getCreateAddress({
      from: admin.address,
      nonce: 2n,
    });

    const poolMathLibraryFactory = await hre.ethers.getContractFactory("PoolMath")
    const poolMathLibrary = await poolMathLibraryFactory.deploy()

    const liquidityToken = await hre.ethers.deployContract("LiquidityToken", [
      tokenName,
      tokenSymbol,
      liquidityPoolAddress,
      admin.address,
    ]);

    const liquidityPool = await hre.ethers.deployContract("LiquidityPool", [
      await admin.getAddress(),
      await liquidityToken.getAddress(),
    ], {
      libraries: {
        PoolMath: poolMathLibrary.target
      }
    });

    const mintable0 = await hre.ethers.deployContract("MintableERC20", [
      "Mintable0",
      "M0",
      assetParams0.decimals,
    ]);
    const mintable1 = await hre.ethers.deployContract("MintableERC20", [
      "Mintable1",
      "M1",
      assetParams1.decimals,
    ]);
    const mintable2 = await hre.ethers.deployContract("MintableERC20", [
      "Mintable2",
      "M2",
      assetParams2.decimals,
    ]);

    await mintable0.mint(admin.address, utils.MAX_UINT_256 / 2n)
    await mintable1.mint(admin.address, utils.MAX_UINT_256 / 2n)
    await mintable2.mint(admin.address, utils.MAX_UINT_256 / 2n)
    await mintable0.approve(liquidityPool.target, utils.MAX_UINT_256)
    await mintable1.approve(liquidityPool.target, utils.MAX_UINT_256)
    await mintable2.approve(liquidityPool.target, utils.MAX_UINT_256)

    await mintable0.mint(unpriviledged.address, utils.MAX_UINT_256 / 2n)
    await mintable1.mint(unpriviledged.address, utils.MAX_UINT_256 / 2n)
    await mintable2.mint(unpriviledged.address, utils.MAX_UINT_256 / 2n)
    await mintable0.attach(unpriviledged).approve(liquidityPool.target, utils.MAX_UINT_256)
    await mintable1.attach(unpriviledged).approve(liquidityPool.target, utils.MAX_UINT_256)
    await mintable2.attach(unpriviledged).approve(liquidityPool.target, utils.MAX_UINT_256)

    // @ts-ignore
    await liquidityPool.setAssetParams([mintable0.target, mintable1.target, mintable2.target], [assetParams0, assetParams1, assetParams2]);
    const maxReservesLimit = utils.MAX_UINT_256 / 2
    const maxReservesLimitRatioQ128 = utils.decimalToFixed(0.1);
    await liquidityPool.setMaxReservesLimit(maxReservesLimit);
    await liquidityPool.setMaxReservesLimi
    return {
      liquidityToken,
      liquidityPool,
      admin,
      unpriviledged,
      tokenName,
      tokenSymbol,
      mintable0,
      mintable1,
      mintable2,
      maxReservesLimitRatioQ128
    };
  }

  it("Deployments", async () => {
    const { liquidityToken, liquidityPool, admin, tokenName, tokenSymbol } = await loadFixture(deployAll);

    // liquidity token
    expect(await liquidityToken.liquidityPool()).to.equal(getAddress(liquidityPool.target));
    expect(await liquidityToken.admin()).to.equal(getAddress(admin.address));
    expect(await liquidityToken.name()).to.equal(tokenName);
    expect(await liquidityToken.symbol()).to.equal(tokenSymbol);

    // liquidity pool
    expect(await liquidityPool.getLiquidityToken()).to.equal(getAddress(liquidityToken.target));
    expect(await liquidityPool.getAdmin()).to.equal(getAddress(admin.address));
  });

  it("getMaxReservesLimit", async function () {
    const { liquidityPool } = await loadFixture(deployAll);

    // Call the getMaxReservesLimit function
    const result = await liquidityPool.getMaxReservesLimit();

    // Assert that the result matches the expected value
    expect(result).to.equal(ethers.MaxUint256);
  })

  it("getMaxReservesIncreaseRateQ128", async function () {
    const { liquidityPool } = await loadFixture(deployAll);

    // Call the getMaxReservesIncreaseRateQ128 function
    const result = await liquidityPool.getMaxReservesIncreaseRateQ128();
    const expected = 
    // Assert that the result matches the expected value
    expect(result).to.be.a('bigint');
  })

  it("getMintFeeQ128", async function() {
    const { liquidityPool } = await loadFixture(deployAll);
    // Set the mint fee to a random value
    const randomMintFee = utils.decimalToFixed(0.01); // Example: 1% mint fee
    await liquidityPool.setMintFeeQ128(randomMintFee);

    // Assert that the mint fee was set correctly
    const setMintFee = await liquidityPool.getMintFeeQ128();
    expect(setMintFee).to.equal(randomMintFee);
  })

  it("getBurnFeeQ128", async function() {
    const { liquidityPool } = await loadFixture(deployAll);
    // Set the burn fee to a random value
    const randomBurnFee = utils.decimalToFixed(0.02); // Example: 2% burn fee
    await liquidityPool.setBurnFeeQ128(randomBurnFee);

    // Assert that the burn fee was set correctly
    const setBurnFee = await liquidityPool.getBurnFeeQ128();
    expect(setBurnFee).to.equal(randomBurnFee);
  })

  it("getIsMintEnabled", async function () {
    const { liquidityPool } = await loadFixture(deployAll);
    const result = await liquidityPool.getIsMintEnabled();
    expect(result).to.equal(true);
  })

  it("getFeesCollected", async function () {
    const { liquidityPool } = await loadFixture(deployAll);
    const result = await liquidityPool.getFeesCollected();
    expect(result).to.equal(0n);
  })

  it("getLiquidityToken", async function () {
    const { liquidityToken, liquidityPool } = await loadFixture(deployAll);
    const result = await liquidityPool.getLiquidityToken();
    expect(result).to.equal(getAddress(liquidityToken.target));
  });

  it("getAdmin", async function () {
    const { admin, liquidityPool } = await loadFixture(deployAll);
    const result = await liquidityPool.getAdmin();
    expect(result).to.equal(getAddress(admin.address));
  });

  it("getAllAssets", async function () {
    const { liquidityPool, mintable0, mintable1, mintable2 } = await loadFixture(deployAll);

    // Call the getAllAssets function
    const allAssets = await liquidityPool.getAllAssets();

    // Assert that the returned assets match the expected assets
    expect(allAssets.length).to.equal(3); // Ensure there are 3 assets
    expect(allAssets[0]).to.equal(getAddress(mintable0.target));
    expect(allAssets[1]).to.equal(getAddress(mintable1.target));
    expect(allAssets[2]).to.equal(getAddress(mintable2.target));
  });

  it("getAllAssetParams", async function () {
    const { liquidityPool } = await loadFixture(deployAll);
    const allAssetParams = await liquidityPool.getAllAssetParams();
    expect(Array.isArray(allAssetParams)).to.be.true;
  });

  it("getAssetParams", async function () {
    const { liquidityPool, mintable0, assetParams0 } = await loadFixture(deployAll);
    const result = await liquidityPool.getAssetParams(mintable0.target);
    expect(result.assetAddress).to.equal(assetParams0.assetAddress);
    expect(result.decimals).to.equal(assetParams0.decimals);
    expect(result.targetAllocation).to.equal(assetParams0.targetAllocation);
  });

  it("getSpecificReservesScaled", async function () {
    const { liquidityPool, mintable0 } = await loadFixture(deployAll);
    const result = await liquidityPool.getSpecificReservesScaled(mintable0.target);
    expect(result).to.equal(0n);
  });

  it("getTotalReservesScaled", async function () {
    const { liquidityPool } = await loadFixture(deployAll);
    const initialTotalReserves = await liquidityPool.getTotalReservesScaled();
    expect(initialTotalReserves).to.equal(0n);
  });

  it("getSpecificReserves", async function () {
    const { liquidityPool, mintable0 } = await loadFixture(deployAll);
    const result = await liquidityPool.getSpecificReserves(mintable0.target);
    expect(result).to.equal(0n);
  });
})