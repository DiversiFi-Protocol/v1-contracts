const {
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { getAddress } = require("ethers");
const utils = require("../testModules/utils.js");
const deployAll = require("./deployAll.js");
const { expect } = require("chai")

describe("LiquidityPool - Getters", function () {
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

  it("getMaxReserves", async function () {
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

  it("getLastMaxReservesChangeTimestamp", async function () {
    const { liquidityPool, setMaxReservesTimestamp } = await loadFixture(deployAll);
    const result = await liquidityPool.getLastMaxReservesChangeTimestamp();
    expect(result).to.equal(setMaxReservesTimestamp);
  });
})