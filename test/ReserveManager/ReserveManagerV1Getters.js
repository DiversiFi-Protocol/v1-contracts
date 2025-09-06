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

describe("ReserveManager - Getters", function () {
  it("Deployments", async () => {
    const { indexToken, reserveManager, admin, tokenName, tokenSymbol } = await loadFixture(deployAll);

    // liquidity token
    expect(await indexToken.getReserveManager()).to.equal(getAddress(reserveManager.target));
    expect(await indexToken.name()).to.equal(tokenName);
    expect(await indexToken.symbol()).to.equal(tokenSymbol);

    // liquidity pool
    expect(await reserveManager.getIndexToken()).to.equal(getAddress(indexToken.target));
  });

  it("getMaxReserves", async function () {
    const { reserveManager, maxReserves } = await loadFixture(deployAll);

    // Call the getMaxReservesfunction
    const result = await reserveManager.getMaxReserves();

    // Assert that the result matches the expected value
    expect(result).to.equal(maxReserves);
  })

  it("getMaxReservesIncreaseRateQ96", async function () {
    const { reserveManager, maxReservesIncreaseRateQ96 } = await loadFixture(deployAll);

    // Call the getMaxReservesIncreaseRateQ96 function
    const result = await reserveManager.getMaxReservesIncreaseRateQ96();
    // Assert that the result matches the expected value
    expect(result).to.equal(maxReservesIncreaseRateQ96);
  })

  it("getMintFeeQ96", async function() {
    const { reserveManager } = await loadFixture(deployAll);
    // Set the mint fee to a random value
    const randomMintFee = utils.decimalToFixed(0.001); // Example: 0.1% mint fee
    await reserveManager.setMintFeeQ96(randomMintFee);

    // Assert that the mint fee was set correctly
    const setMintFee = await reserveManager.getMintFeeQ96();
    expect(setMintFee).to.equal(randomMintFee);
  })

  describe("getBurnFeeQ96", function() {
    it("should return the burn fee", async function() {
      const { reserveManager } = await loadFixture(deployAll);
      // Set the burn fee to a random value
      const randomBurnFee = utils.decimalToFixed(0.002); // Example: 0.2% burn fee
      await reserveManager.setBurnFeeQ96(randomBurnFee);

      // Assert that the burn fee was set correctly
      const setBurnFee = await reserveManager.getBurnFeeQ96();
      expect(setBurnFee).to.equal(randomBurnFee);
    })

    it("should return zero if the pool is migrating", async function() {
      const { indexToken, reserveManager, reserveManager0, minbalanceDivisorChangeDelay, maxbalanceDivisorChangePerSecondQ96 } = await loadFixture(deployAll);
      // Set the burn fee to a random value
      const randomBurnFee = utils.decimalToFixed(0.002); // Example: 0.2% burn fee
      await reserveManager.setBurnFeeQ96(randomBurnFee);
      const block0 = await hre.ethers.provider.getBlock("latest");
      const block0Time = BigInt(block0.timestamp)
      await indexToken.startMigration(
        reserveManager0, block0Time + 1n + minbalanceDivisorChangeDelay, maxbalanceDivisorChangePerSecondQ96
      )

      // Assert that the burn fee was set correctly
      const setBurnFee = await reserveManager.getBurnFeeQ96();
      expect(setBurnFee).to.equal(0n);
    })
  })

  it("getIsMintEnabled", async function () {
    const { reserveManager } = await loadFixture(deployAll);
    const result = await reserveManager.getIsMintEnabled();
    expect(result).to.equal(true);
  })

  describe("getSurplus", function () {
    it("should return the token balance as fees", async function() {
      const { reserveManager, indexToken } = await loadFixture(deployAll);
      await reserveManager.mint(1000000n, "0x")
      const surplusBefore = await reserveManager.getSurplus()
      const burnAmount = 42069n
      await indexToken.burn(burnAmount)
      const surplusAfter = await reserveManager.getSurplus();
      expect(surplusAfter - surplusBefore).to.equal(burnAmount);
    })

    it("should deduct the equalization bounty from the fees collected", async function() {
      const { reserveManager, indexToken } = await loadFixture(deployAll);
      await reserveManager.mint(1000000n, "0x")
      const feesBefore = await reserveManager.getSurplus()
      const burnAmount = 42069n
      const equalizationBounty = 69n
      await indexToken.burn(burnAmount)
      await reserveManager.increaseEqualizationBounty(equalizationBounty)
      const feesAfter = await reserveManager.getSurplus()
      expect(feesAfter - feesBefore).to.equal(burnAmount - equalizationBounty)
    })
  })

  it("getIndexToken", async function () {
    const { indexToken, reserveManager } = await loadFixture(deployAll);
    const result = await reserveManager.getIndexToken();
    expect(result).to.equal(getAddress(indexToken.target));
  });

  it("getAllAssets", async function () {
    const { reserveManager, mintable0, mintable1, mintable2 } = await loadFixture(deployAll);

    // Call the getAllAssets function
    const allAssets = await reserveManager.getAllAssets();

    // Assert that the returned assets match the expected assets
    expect(allAssets.length).to.equal(3); // Ensure there are 3 assets
    expect(allAssets[0]).to.equal(getAddress(mintable0.target));
    expect(allAssets[1]).to.equal(getAddress(mintable1.target));
    expect(allAssets[2]).to.equal(getAddress(mintable2.target));
  });

  it("getCurrentAssetParams", async function () {
    const { reserveManager, assetParams0, assetParams1, assetParams2 } = await loadFixture(deployAll);
    const allAssetParams = await reserveManager.getCurrentAssetParams();
    const expected = [assetParams0, assetParams1, assetParams2]
    allAssetParams.forEach((params, i) => {
      expect(params[0]).to.equal(expected[i].assetAddress);
      expect(params[1]).to.equal(expected[i].targetAllocation);
      expect(params[2]).to.equal(expected[i].decimals);
    });
  });

  it("getTargetAssetParams", async function () {
    const { reserveManager, assetParams0, assetParams1, assetParams2 } = await loadFixture(deployAll);
    const allAssetParams = await reserveManager.getTargetAssetParams();
    const expected = [assetParams0, assetParams1, assetParams2]
    allAssetParams.forEach((params, i) => {
      expect(params[0]).to.equal(expected[i].assetAddress);
      expect(params[1]).to.equal(expected[i].targetAllocation);
      expect(params[2]).to.equal(expected[i].decimals);
    });
  });

  it("getAssetParams", async function () {
    const { reserveManager, mintable0, assetParams0 } = await loadFixture(deployAll);
    const result = await reserveManager.getAssetParams(mintable0.target);
    expect(result.assetAddress).to.equal(assetParams0.assetAddress);
    expect(result.decimals).to.equal(assetParams0.decimals);
    expect(result.targetAllocation).to.equal(assetParams0.targetAllocation);
  });

  it("getSpecificReservesScaled", async function () {
    const { reserveManager, mintable0 } = await loadFixture(deployAll);
    const result = await reserveManager.getSpecificReservesScaled(mintable0.target);
    expect(result).to.equal(0n);
  });

  it("getTotalReservesScaled", async function () {
    const { reserveManager } = await loadFixture(deployAll);
    const initialTotalReserves = await reserveManager.getTotalReservesScaled();
    expect(initialTotalReserves).to.equal(0n);
  });

  it("getSpecificReserves", async function () {
    const { reserveManager, mintable0 } = await loadFixture(deployAll);
    const result = await reserveManager.getSpecificReserves(mintable0.target);
    expect(result).to.equal(0n);
  });

  it("getMaxReserves", async function () {
    const { reserveManager, maxReserves } = await loadFixture(deployAll)
    const result = await reserveManager.getMaxReserves()
    expect(result).to.equal(maxReserves);
  })

  it("getMaxReservesIncreaseCooldown", async function () {
    const { reserveManager } = await loadFixture(deployAll);
    // Default value is 1 hour in seconds
    const result = await reserveManager.getMaxReservesIncreaseCooldown();
    expect(result).to.equal(60 * 60); // 1 hour in seconds
  });

  it("getLastMaxReservesChangeTimestamp", async function () {
    const { reserveManager, maintainer, setMaxReservesTimestamp } = await loadFixture(deployAll);
    await reserveManager.connect(maintainer).setMaxReserves(42069n)
    const latestBlock = await ethers.provider.getBlock("latest");
    const result = await reserveManager.getLastMaxReservesChangeTimestamp();
    expect(result).to.equal(latestBlock.timestamp);
  });

  it("getEqualizationVectorScaled", async function () {
    const { reserveManager } = await loadFixture(deployAll)
    const result = await reserveManager.getEqualizationVectorScaled()
    expect(result[0]).to.equal(0n)
    expect(result[1]).to.equal(0n)
    expect(result[2]).to.equal(0n)
  })

  it("getTotalReservesDiscrepencyScaled", async function () {
    const { reserveManager } = await loadFixture(deployAll)
    const result = await reserveManager.getTotalReservesDiscrepencyScaled()
    expect(result).to.equal(0n)
  })

  it("getIsEqualized", async function () {
    const { reserveManager } = await loadFixture(deployAll)
    const result = await reserveManager.getIsEqualized()
    expect(result).to.equal(true)
  })

  it("getEqualizationBounty", async function () {
    const { reserveManager } = await loadFixture(deployAll)
    await reserveManager.mint(1000n, "0x")
    const equalizationBounty = 1n
    await reserveManager.increaseEqualizationBounty(equalizationBounty)
    expect(await reserveManager.getEqualizationBounty()).to.equal(equalizationBounty)
  })

  describe("getMigrationBurnConversionRateQ96", function () {
    it("should return 1 if there is no migration", async function () {
      const { reserveManager } = await loadFixture(deployAll)
      const oneQ96 = 1n << utils.SHIFT
      expect(await reserveManager.getMigrationBurnConversionRateQ96()).to.equal(oneQ96)
    })

    it("should return an increasing number if migrating", async function () {
      const { reserveManager, indexToken, reserveManager0, minbalanceDivisorChangeDelay, maxbalanceDivisorChangePerSecondQ96 } = await loadFixture(deployAll)
      const oneQ96 = 1n << utils.SHIFT
      const block0 = await hre.ethers.provider.getBlock("latest");
      const block0Time = BigInt(block0.timestamp)
      await indexToken.startMigration(
        reserveManager0, 
        block0Time + 1n + minbalanceDivisorChangeDelay,
        maxbalanceDivisorChangePerSecondQ96,
      )
      await increaseTime(Number(minbalanceDivisorChangeDelay) + 100)
      const conversionRate = await reserveManager.getMigrationBurnConversionRateQ96()
      expect(conversionRate).to.be.greaterThan(oneQ96)
    })
  })

  describe("isEmigrating", function () {
    it("should return false if not emigrating", async function () {
      const { reserveManager, indexToken, reserveManager0, minbalanceDivisorChangeDelay, maxbalanceDivisorChangePerSecondQ96 } = await loadFixture(deployAll)
      expect(await reserveManager.isEmigrating()).to.equal(false)
    })

    it("should return true if emigrating", async function () {
      const { reserveManager, indexToken, reserveManager0, minbalanceDivisorChangeDelay, maxbalanceDivisorChangePerSecondQ96 } = await loadFixture(deployAll)
      const block0 = await hre.ethers.provider.getBlock("latest");
      const block0Time = BigInt(block0.timestamp)
      await indexToken.startMigration(
        reserveManager0, 
        block0Time + 1n + minbalanceDivisorChangeDelay,
        maxbalanceDivisorChangePerSecondQ96,
      )
      expect(await reserveManager.isEmigrating()).to.equal(true)
    })
  })
})