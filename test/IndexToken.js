const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const hre = require("hardhat");
const utils = require("./testModules/utils");

async function deployIndex() {
  const [liquidityPool, nextLiquidityPool, unpriviledged0] = await hre.ethers.getSigners()
  const tokenName = "Diversified USD";
  const tokenSymbol = "USD1";
  const minBalanceMultiplierChangeDelay = 100n
  const maxBalanceMultiplierChangePerSecondQ96 = utils.decimalToFixed(0.999)
  const indexToken = await hre.ethers.deployContract("IndexToken", [
    tokenName,
    tokenSymbol,
    liquidityPool.address,
    minBalanceMultiplierChangeDelay,
    maxBalanceMultiplierChangePerSecondQ96
  ]);
  await indexToken.mint(liquidityPool.address, utils.scale10Pow18(1_000_000n))
  return { indexToken, liquidityPool, nextLiquidityPool, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96, unpriviledged0 }
}

describe("IndexToken", function() {
  describe("Special Functionality", function() {
    describe("isMigrating", function() {
      it("returns false if not migrating", async function() {
        const { indexToken } = await loadFixture(deployIndex)
        expect(await indexToken.isMigrating()).to.equal(false)
      })

      it("returns true if migrating", async function() {
        const { 
          indexToken,
          nextLiquidityPool, 
          minBalanceMultiplierChangeDelay, 
          maxBalanceMultiplierChangePerSecondQ96 
        } = await loadFixture(deployIndex)
        console.log("nextLiquidityPool", nextLiquidityPool)
        await indexToken.startMigration(
          nextLiquidityPool, 
          minBalanceMultiplierChangeDelay, 
          maxBalanceMultiplierChangePerSecondQ96
        )
        expect(await indexToken.isMigrating()).to.equal(true)

      })
    })

    describe("getNextLiquidityPool", function() {
      it("returns 0 address if not migrating", async function() {
        const { indexToken, liquidityPool, nextLiquidityPool, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96 } = await loadFixture(deployIndex)
        expect(await indexToken.getNextLiquidityPool()).to.equal(hre.ethers.ZeroAddress)
      })

      it("returns next address if migrating", async function() {
        const { indexToken, liquidityPool, nextLiquidityPool, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96 } = await loadFixture(deployIndex)
        await indexToken.startMigration(
          nextLiquidityPool, 
          minBalanceMultiplierChangeDelay, 
          maxBalanceMultiplierChangePerSecondQ96
        )
        expect(await indexToken.getNextLiquidityPool()).to.equal(nextLiquidityPool)
      })
    })

    describe("getLastBalanceMultiplierQ96", function() {
      it("returns last balance multiplier", async function() {
        const { indexToken, liquidityPool, nextLiquidityPool, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96 } = await loadFixture(deployIndex)
        expect(await indexToken.getLastBalanceMultiplierQ96()).to.equal(2n**96n - 1n)
      })
    })

    describe("getMigrationStartTimestamp", function() {
      it("returns the start timestamp that the migration started", async function() {
        const { indexToken, liquidityPool, nextLiquidityPool, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96 } = await loadFixture(deployIndex)
        await indexToken.startMigration(
          nextLiquidityPool, 
          minBalanceMultiplierChangeDelay, 
          maxBalanceMultiplierChangePerSecondQ96
        )
        const latestBlock = await ethers.provider.getBlock("latest");
        expect(await indexToken.getMigrationStartTimestamp()).to.equal(latestBlock.timestamp)
      })
    })

    describe("getBalanceMultiplierChangePerSecondQ96", function() {
      it("returns the balance multiplier change per second set when the migration started", async function() {
        const { indexToken, liquidityPool, nextLiquidityPool, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96 } = await loadFixture(deployIndex)
        await indexToken.startMigration(
          nextLiquidityPool, 
          minBalanceMultiplierChangeDelay, 
          maxBalanceMultiplierChangePerSecondQ96
        )
        expect(await indexToken.getBalanceMultiplierChangePerSecondQ96()).to.equal(maxBalanceMultiplierChangePerSecondQ96)
      })
    })

    describe("getLiquidityPool", function() {
      it("returns the current liquidity pool", async function() {
        const { indexToken, liquidityPool, nextLiquidityPool, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96, unpriviledged0 } = await loadFixture(deployIndex)
        expect(await indexToken.getLiquidityPool()).to.equal(liquidityPool)
      })
    })

    describe("startMigration", function() {
      it("should not be callable by non-admin address", async function() {

      })

      it("should not be callable if a migration is already happening", async function() {

      })

      it("should fail if the change delay is too below the minimum", async function() {

      })

      it("should fail if the balance multiplier change per second is gt 1", async function() {

      })

      it("should fail if the balance multiplier change per second is greater than the max rate", async function() {

      })

      it("should set the relevant variables", async function() {

      })
    })

    describe("finishMigration", function() {
      it("should not be callable by a non-admin", async function() {

      })

      it("should not be callable if not migrating", async function() {

      })

      it("should set the relevant variables", async function() {

      })
    })

    describe("balanceMultiplierQ96", function() {
      it("balance multiplier should be static during non-migration", async function() {

      })

      it("balance multiplier should tick down at the correct rate during migration", async function() {

      })

      it("balance multiplier should not tick down during grace period", async function() {

      })
    })
  })

  describe("ERC20 Functionality", function() {
    describe("totalSupply", function() {
      it("should return the correct value", async function() {

      })

      it("should change when the balance multiplier ticks down", async function() {

      })
    })

    describe("balanceOf", function() {
      it("should return the correct value", async function() {

      })

      it("should change when the balance multiplier ticks down", async function() {

      })
    })

    describe("transfer", function() {
      it("should transfer the exact amount", async function() {

      })
    })

    describe("allowance", function() {
      it("should return the allowance in visible units", async function() {

      })

      it("allowance should not tick down with the balance multiplier", async function() {

      })
    })

    describe("approve", function() {
      it("should set the allowance with the correct values", async function() {

      })
    })

    describe("transferFrom", function() {
      it("should transfer the correct amount", async function() {

      })

      it("should deduct the allowance by the correct amount", async function() {

      })
    })

    describe("decimals", function() {
      it("should return the correct decimals", async function() {

      })
    })

    describe("mint", function() {
      it("should mint the correct amount", async function() {

      })

      it("should still work after a balance multiplier change", async function() {

      })
    })

    describe("burnFrom", function() {
      it("should burn the correct amount", async function() {

      })

      it("should still work after a balance multiplier change", async function() {

      })
    })
  })
})