const {
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { getAddress } = require("ethers");
const utils = require("../testModules/utils.js");
const deployAll = require("../deployAll.js");
const { expect } = require("chai")

async function increaseTime(seconds) {
  await ethers.provider.send("evm_increaseTime", [seconds]);

  // Mine a new block so the increased time takes effect
  await ethers.provider.send("evm_mine", []);
}

describe("LiquidityPool - Getters", function () {
  it("Deployments", async () => {
    const { indexToken, liquidityPool, admin, tokenName, tokenSymbol } = await loadFixture(deployAll);

    // liquidity token
    expect(await indexToken.getLiquidityPool()).to.equal(getAddress(liquidityPool.target));
    expect(await indexToken.name()).to.equal(tokenName);
    expect(await indexToken.symbol()).to.equal(tokenSymbol);

    // liquidity pool
    expect(await liquidityPool.getIndexToken()).to.equal(getAddress(indexToken.target));
    expect(await liquidityPool.getAdmin()).to.equal(getAddress(admin.address));
  });

  it("getMaxReserves", async function () {
    const { liquidityPool, maxReserves } = await loadFixture(deployAll);

    // Call the getMaxReservesfunction
    const result = await liquidityPool.getMaxReserves();

    // Assert that the result matches the expected value
    expect(result).to.equal(maxReserves);
  })

  it("getMaxReservesIncreaseRateQ96", async function () {
    const { liquidityPool, maxReservesIncreaseRateQ96 } = await loadFixture(deployAll);

    // Call the getMaxReservesIncreaseRateQ96 function
    const result = await liquidityPool.getMaxReservesIncreaseRateQ96();
    // Assert that the result matches the expected value
    expect(result).to.equal(maxReservesIncreaseRateQ96);
  })

  it("getMintFeeQ96", async function() {
    const { liquidityPool } = await loadFixture(deployAll);
    // Set the mint fee to a random value
    const randomMintFee = utils.decimalToFixed(0.01); // Example: 1% mint fee
    await liquidityPool.setMintFeeQ96(randomMintFee);

    // Assert that the mint fee was set correctly
    const setMintFee = await liquidityPool.getMintFeeQ96();
    expect(setMintFee).to.equal(randomMintFee);
  })

  describe("getBurnFeeQ96", function() {
    it("should return the burn fee", async function() {
      const { liquidityPool } = await loadFixture(deployAll);
      // Set the burn fee to a random value
      const randomBurnFee = utils.decimalToFixed(0.02); // Example: 2% burn fee
      await liquidityPool.setBurnFeeQ96(randomBurnFee);

      // Assert that the burn fee was set correctly
      const setBurnFee = await liquidityPool.getBurnFeeQ96();
      expect(setBurnFee).to.equal(randomBurnFee);
    })

    it("should return zero if the pool is migrating", async function() {
      const { liquidityPool, liquidityPool0, minbalanceDivisorChangeDelay, maxbalanceDivisorChangePerSecondQ96 } = await loadFixture(deployAll);
      // Set the burn fee to a random value
      const randomBurnFee = utils.decimalToFixed(0.02); // Example: 2% burn fee
      await liquidityPool.setBurnFeeQ96(randomBurnFee);
      await liquidityPool.startEmigration(
        liquidityPool0, minbalanceDivisorChangeDelay, maxbalanceDivisorChangePerSecondQ96
      )

      // Assert that the burn fee was set correctly
      const setBurnFee = await liquidityPool.getBurnFeeQ96();
      expect(setBurnFee).to.equal(0n);
    })
  })

  it("getIsMintEnabled", async function () {
    const { liquidityPool } = await loadFixture(deployAll);
    const result = await liquidityPool.getIsMintEnabled();
    expect(result).to.equal(true);
  })

  describe("getSurplus", function () {
    it("should return the token balance as fees", async function() {
      const { liquidityPool, indexToken } = await loadFixture(deployAll);
      await liquidityPool.mint(1000000n, "0x")
      const surplusBefore = await liquidityPool.getSurplus()
      const burnAmount = 42069n
      await indexToken.burn(burnAmount)
      const surplusAfter = await liquidityPool.getSurplus();
      expect(surplusAfter - surplusBefore).to.equal(burnAmount);
    })

    it("should deduct the equalization bounty from the fees collected", async function() {
      const { liquidityPool, indexToken } = await loadFixture(deployAll);
      await liquidityPool.mint(1000000n, "0x")
      const feesBefore = await liquidityPool.getSurplus()
      const burnAmount = 42069n
      const equalizationBounty = 69n
      await indexToken.burn(burnAmount)
      await liquidityPool.increaseEqualizationBounty(equalizationBounty)
      const feesAfter = await liquidityPool.getSurplus()
      expect(feesAfter - feesBefore).to.equal(burnAmount - equalizationBounty)
    })
  })

  it("getIndexToken", async function () {
    const { indexToken, liquidityPool } = await loadFixture(deployAll);
    const result = await liquidityPool.getIndexToken();
    expect(result).to.equal(getAddress(indexToken.target));
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

  it("getCurrentAssetParams", async function () {
    const { liquidityPool, assetParams0, assetParams1, assetParams2 } = await loadFixture(deployAll);
    const allAssetParams = await liquidityPool.getCurrentAssetParams();
    const expected = [assetParams0, assetParams1, assetParams2]
    allAssetParams.forEach((params, i) => {
      expect(params[0]).to.equal(expected[i].assetAddress);
      expect(params[1]).to.equal(expected[i].targetAllocation);
      expect(params[2]).to.equal(expected[i].decimals);
    });
  });

  it("getTargetAssetParams", async function () {
    const { liquidityPool, assetParams0, assetParams1, assetParams2 } = await loadFixture(deployAll);
    const allAssetParams = await liquidityPool.getTargetAssetParams();
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

  it("getMaxReserves", async function () {
    const { liquidityPool, maxReserves } = await loadFixture(deployAll)
    const result = await liquidityPool.getMaxReserves()
    expect(result).to.equal(maxReserves);
  })

  it("getMaxReservesIncreaseCooldown", async function () {
    const { liquidityPool } = await loadFixture(deployAll);
    // Default value is 1 hour in seconds
    const result = await liquidityPool.getMaxReservesIncreaseCooldown();
    expect(result).to.equal(60 * 60); // 1 hour in seconds
  });

  it("getLastMaxReservesChangeTimestamp", async function () {
    const { liquidityPool, setMaxReservesTimestamp } = await loadFixture(deployAll);
    await liquidityPool.setMaxReserves(42069n)
    const latestBlock = await ethers.provider.getBlock("latest");
    const result = await liquidityPool.getLastMaxReservesChangeTimestamp();
    expect(result).to.equal(latestBlock.timestamp);
  });

  it("getEqualizationVectorScaled", async function () {
    const { liquidityPool } = await loadFixture(deployAll)
    const result = await liquidityPool.getEqualizationVectorScaled()
    expect(result[0]).to.equal(0n)
    expect(result[1]).to.equal(0n)
    expect(result[2]).to.equal(0n)
  })

  it("getTotalReservesDiscrepencyScaled", async function () {
    const { liquidityPool } = await loadFixture(deployAll)
    const result = await liquidityPool.getTotalReservesDiscrepencyScaled()
    expect(result).to.equal(0n)
  })

  it("getIsEqualized", async function () {
    const { liquidityPool } = await loadFixture(deployAll)
    const result = await liquidityPool.getIsEqualized()
    expect(result).to.equal(true)
  })

  it("getEqualizationBounty", async function () {
    const { liquidityPool } = await loadFixture(deployAll)
    await liquidityPool.mint(1000n, "0x")
    const equalizationBounty = 1n
    await liquidityPool.increaseEqualizationBounty(equalizationBounty)
    expect(await liquidityPool.getEqualizationBounty()).to.equal(equalizationBounty)
  })

  describe("getMigrationBurnConversionRateQ96", function () {
    it("should return 1 if there is no migration", async function () {
      const { liquidityPool } = await loadFixture(deployAll)
      const oneQ96 = 1n << utils.SHIFT
      expect(await liquidityPool.getMigrationBurnConversionRateQ96()).to.equal(oneQ96)
    })

    it("should return an increasing number if migrating", async function () {
      const { liquidityPool, indexToken, liquidityPool0, minbalanceDivisorChangeDelay, maxbalanceDivisorChangePerSecondQ96 } = await loadFixture(deployAll)
      const oneQ96 = 1n << utils.SHIFT
      await liquidityPool.startEmigration(
        liquidityPool0, 
        minbalanceDivisorChangeDelay,
        maxbalanceDivisorChangePerSecondQ96,
      )
      await increaseTime(Number(minbalanceDivisorChangeDelay) + 100)
      const conversionRate = await liquidityPool.getMigrationBurnConversionRateQ96()
      expect(conversionRate).to.be.greaterThan(oneQ96)
    })
  })

  describe("isEmigrating", function () {
    it("should return false if not emigrating", async function () {
      const { liquidityPool, indexToken, liquidityPool0, minbalanceDivisorChangeDelay, maxbalanceDivisorChangePerSecondQ96 } = await loadFixture(deployAll)
      expect(await liquidityPool.isEmigrating()).to.equal(false)
    })

    it("should return true if emigrating", async function () {
      const { liquidityPool, indexToken, liquidityPool0, minbalanceDivisorChangeDelay, maxbalanceDivisorChangePerSecondQ96 } = await loadFixture(deployAll)
      await liquidityPool.startEmigration(
        liquidityPool0, 
        minbalanceDivisorChangeDelay,
        maxbalanceDivisorChangePerSecondQ96,
      )
      expect(await liquidityPool.isEmigrating()).to.equal(true)
    })
  })
})