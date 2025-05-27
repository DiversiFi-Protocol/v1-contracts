const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const hre = require("hardhat");
const { getAddress, parseGwei, getCreateAddress, maxUint16 } = require("ethers");
const utils = require("../testModules/utils.js");
const { expect } = require("chai")

describe("LiquidityPool - Getters", function () {
  async function deployAll() {
    const tokenName = "Diversified USD";
    const tokenSymbol = "USD1";
    const mintable0Decimals = 18n;
    const mintable0TargetAllocation = utils.formatAllocationFromDecimal(0.333333333333333333333333333333333)
    const mintable1Decimals = 20n;
    const mintable1TargetAllocation = utils.formatAllocationFromDecimal(0.333333333333333333333333333333333)
    const mintable2Decimals = 6n;
    //the remaining allocation goes to mintable2
    const mintable2TargetAllocation = (2n ** 88n - 1n) - mintable0TargetAllocation - mintable1TargetAllocation;
    const [admin, unpriviledged] = await hre.ethers.getSigners();
    const liquidityPoolAddress = getCreateAddress({
      from: admin.address,
      nonce: 1n,
    });

    const liquidityToken = await hre.ethers.deployContract("LiquidityToken", [
      tokenName,
      tokenSymbol,
      liquidityPoolAddress,
      admin.address,
    ]);

    const liquidityPool = await hre.ethers.deployContract("LiquidityPool", [
      await admin.getAddress(),
      await liquidityToken.getAddress(),
    ]);

    const mintable0 = await hre.ethers.deployContract("MintableERC20", [
      "Mintable0",
      "M0",
      mintable0Decimals,
    ]);
    const mintable1 = await hre.ethers.deployContract("MintableERC20", [
      "Mintable1",
      "M1",
      mintable1Decimals,
    ]);
    const mintable2 = await hre.ethers.deployContract("MintableERC20", [
      "Mintable2",
      "M2",
      mintable2Decimals,
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

    assetParams0 = {
      decimals: mintable0Decimals,
      targetAllocation: mintable0TargetAllocation,
      assetAddress: getAddress(mintable0.target),
    }
    assetParams1 = {
      decimals: mintable1Decimals,
      targetAllocation: mintable1TargetAllocation,
      assetAddress: getAddress(mintable1.target),
    }
    assetParams2 = {
      decimals: mintable2Decimals,
      targetAllocation: mintable2TargetAllocation,
      assetAddress: getAddress(mintable2.target),
    }
    await liquidityPool.setAssetParams([
      assetParams0,
      assetParams1,
      assetParams2,
    ]);
    const maxReserves = utils.MAX_UINT_256 / 2n
    const maxReservesIncreaseRateQ128 = utils.decimalToFixed(0.1);
    await liquidityPool.setMaxReserves(maxReserves);
    const setMaxReservesBlock = await hre.ethers.provider.getBlock('latest');
    const setMaxReservesTimestamp = setMaxReservesBlock.timestamp;
    await liquidityPool.setMaxReservesIncreaseRateQ128(maxReservesIncreaseRateQ128);

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
      maxReserves,
      maxReservesIncreaseRateQ128,
      assetParams0,
      assetParams1,
      assetParams2,
      setMaxReservesTimestamp
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
    const { liquidityPool, maxReserves } = await loadFixture(deployAll);

    // Call the getMaxReservesfunction
    const result = await liquidityPool.getMaxReserves();

    // Assert that the result matches the expected value
    expect(result).to.equal(maxReserves);
  })

  it("getMaxReservesIncreaseRateQ128", async function () {
    const { liquidityPool, maxReservesIncreaseRateQ128 } = await loadFixture(deployAll);

    // Call the getMaxReservesIncreaseRateQ128 function
    const result = await liquidityPool.getMaxReservesIncreaseRateQ128();
    // Assert that the result matches the expected value
    expect(result).to.equal(maxReservesIncreaseRateQ128);
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
    const { liquidityPool, assetParams0, assetParams1, assetParams2 } = await loadFixture(deployAll);
    const allAssetParams = await liquidityPool.getAllAssetParams();
    const expected = [assetParams0, assetParams1, assetParams2]
    allAssetParams.forEach((params, i) => {
      expect(params[0]).to.equal(expected[i].assetAddress);
      expect(params[1]).to.equal(expected[i].targetAllocation);
      expect(params[2]).to.equal(expected[i].decimals);
    });
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

  it("getMaxReservesIncreaseCooldown", async function () {
    const { liquidityPool } = await loadFixture(deployAll);
    // Default value is 1 day in seconds
    const result = await liquidityPool.getMaxReservesIncreaseCooldown();
    expect(result).to.equal(24 * 60 * 60); // 1 day in seconds
  });

  it("getLastLimitChangeTimestamp", async function () {
    const { liquidityPool, setMaxReservesTimestamp } = await loadFixture(deployAll);
    const result = await liquidityPool.getLastLimitChangeTimestamp();
    expect(result).to.equal(setMaxReservesTimestamp);
  });
})