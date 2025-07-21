const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const hre = require("hardhat");
const utils = require("./testModules/utils");

async function deployIndex() {
  const [liquidityPool, nextLiquidityPool, unprivileged0] = await hre.ethers.getSigners()
  const tokenName = "Diversified USD";
  const tokenSymbol = "USD1";
  const minBalanceMultiplierChangeDelay = 100n
  const maxBalanceMultiplierChangePerSecondQ96 = utils.decimalToFixed(1.001)
  const indexToken = await hre.ethers.deployContract("IndexToken", [
    tokenName,
    tokenSymbol,
    liquidityPool.address,
    minBalanceMultiplierChangeDelay,
    maxBalanceMultiplierChangePerSecondQ96
  ]);
  const startingTotalSupply = utils.scale10Pow18(1_000_000n)
  await indexToken.mint(liquidityPool.address, startingTotalSupply)
  return { indexToken, liquidityPool, nextLiquidityPool, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96, unprivileged0, startingTotalSupply }
}

async function increaseTime(seconds) {
  await ethers.provider.send("evm_increaseTime", [seconds]);

  // Mine a new block so the increased time takes effect
  await ethers.provider.send("evm_mine", []);
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

    describe("getLastBalanceMultiplier", function() {
      it("returns last balance multiplier", async function() {
        const { indexToken, liquidityPool, nextLiquidityPool, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96 } = await loadFixture(deployIndex)
        expect(await indexToken.getLastBalanceMultiplier()).to.equal(2n**88n - 1n)
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

    describe("getBalanceMultiplierChangeDelay", function() {
      it("should return the change delay", async function() {
        const { indexToken, liquidityPool, nextLiquidityPool, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96 } = await loadFixture(deployIndex)
        await indexToken.startMigration(
          nextLiquidityPool, 
          minBalanceMultiplierChangeDelay, 
          maxBalanceMultiplierChangePerSecondQ96
        )
        expect(await indexToken.getBalanceMultiplierChangeDelay()).to.equal(minBalanceMultiplierChangeDelay)
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
        const { indexToken, liquidityPool, nextLiquidityPool, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96, unprivileged0, startingTotalSupply } = await loadFixture(deployIndex)
        expect(await indexToken.getLiquidityPool()).to.equal(liquidityPool)
      })
    })

    describe("startMigration", function() {
      it("should not be callable by non-admin address", async function() {
        const { indexToken, liquidityPool, nextLiquidityPool, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96, unprivileged0, startingTotalSupply } = await loadFixture(deployIndex)
        await expect(indexToken.connect(unprivileged0).startMigration(
          nextLiquidityPool,
          minBalanceMultiplierChangeDelay,
          maxBalanceMultiplierChangePerSecondQ96
        )).to.be.revertedWith("only liquidity pool")
      })

      it("should not be callable if a migration is already happening", async function() {
        const { indexToken, liquidityPool, nextLiquidityPool, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96, unprivileged0, startingTotalSupply } = await loadFixture(deployIndex)
        await indexToken.startMigration(
          nextLiquidityPool,
          minBalanceMultiplierChangeDelay,
          maxBalanceMultiplierChangePerSecondQ96
        )
        await expect(indexToken.startMigration(
          nextLiquidityPool,
          minBalanceMultiplierChangeDelay,
          maxBalanceMultiplierChangePerSecondQ96
        )).to.be.revertedWith("liquidityPool is migrating")
      })

      it("should fail if the change delay is too below the minimum", async function() {
        const { indexToken, liquidityPool, nextLiquidityPool, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96, unprivileged0, startingTotalSupply } = await loadFixture(deployIndex)
        await expect(indexToken.startMigration(
          nextLiquidityPool,
          minBalanceMultiplierChangeDelay -1n,
          maxBalanceMultiplierChangePerSecondQ96
        )).to.be.revertedWith("balance multiplier change delay too short")
      })

      it("should fail if the balance multiplier change per second is greater than the max rate", async function() {
        const { indexToken, liquidityPool, nextLiquidityPool, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96, unprivileged0, startingTotalSupply } = await loadFixture(deployIndex)
        await expect(indexToken.startMigration(
          nextLiquidityPool,
          minBalanceMultiplierChangeDelay,
          maxBalanceMultiplierChangePerSecondQ96 - 1n
        )).to.be.revertedWith("balance multiplier change rate too high")
      })

      it("should set the relevant variables", async function() {
        const { indexToken, liquidityPool, nextLiquidityPool, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96, unprivileged0, startingTotalSupply } = await loadFixture(deployIndex)
        await indexToken.startMigration(
          nextLiquidityPool,
          minBalanceMultiplierChangeDelay,
          maxBalanceMultiplierChangePerSecondQ96
        )
        const latestBlock = await ethers.provider.getBlock("latest");
        expect(await indexToken.getNextLiquidityPool()).to.equal(nextLiquidityPool)
        expect(await indexToken.getMigrationStartTimestamp()).to.equal(latestBlock.timestamp)
        expect(await indexToken.getBalanceMultiplierChangeDelay()).to.equal(minBalanceMultiplierChangeDelay)
        expect(await indexToken.getBalanceMultiplierChangePerSecondQ96()).to.equal(maxBalanceMultiplierChangePerSecondQ96)
      })
    })

    describe("finishMigration", function() {
      it("should not be callable by a non-admin", async function() {
        const { indexToken, liquidityPool, nextLiquidityPool, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96, unprivileged0, startingTotalSupply } = await loadFixture(deployIndex)
        await indexToken.startMigration(
          nextLiquidityPool,
          minBalanceMultiplierChangeDelay,
          maxBalanceMultiplierChangePerSecondQ96
        )
        await expect(
          indexToken.connect(unprivileged0).finishMigration(startingTotalSupply)
        ).to.be.revertedWith("only liquidity pool")
      })

      it("should not be callable if not migrating", async function() {
        const { indexToken, liquidityPool, nextLiquidityPool, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96, unprivileged0, startingTotalSupply } = await loadFixture(deployIndex)
        await expect(
          indexToken.finishMigration(startingTotalSupply)
        ).to.be.revertedWith("liquidityPool not migrating")
      })

      it("should set the relevant variables", async function() {
        const { indexToken, liquidityPool, nextLiquidityPool, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96, unprivileged0, startingTotalSupply } = await loadFixture(deployIndex)
        await indexToken.startMigration(
          nextLiquidityPool,
          minBalanceMultiplierChangeDelay,
          maxBalanceMultiplierChangePerSecondQ96
        )
        const startingBalanceMultiplier = await indexToken.balanceMultiplier()
        await increaseTime(Number(minBalanceMultiplierChangeDelay) + 1)
        const endingBalanceMultiplier = await indexToken.balanceMultiplier()
        expect(startingBalanceMultiplier).to.be.lessThan(endingBalanceMultiplier, "balance multiplier did not increase")
        await indexToken.finishMigration(startingTotalSupply - 1n)
        expect(await indexToken.getLiquidityPool()).to.equal(nextLiquidityPool)
        expect(await indexToken.getNextLiquidityPool()).to.equal(ethers.ZeroAddress)
        expect(await indexToken.isMigrating()).to.equal(false)
        expect(await indexToken.getLastBalanceMultiplier()).to.be.greaterThan(startingBalanceMultiplier)
      })
    })

    describe("balanceMultiplier", function() {
      it("balance multiplier should be static during non-migration", async function() {
        const { indexToken, liquidityPool, nextLiquidityPool, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96, unprivileged0, startingTotalSupply } = await loadFixture(deployIndex)
        const startingBalanceMultiplier = await indexToken.balanceMultiplier()
        await increaseTime(Number(minBalanceMultiplierChangeDelay) + 100000000000)
        const endingBalanceMultiplier = await indexToken.balanceMultiplier()
        expect(startingBalanceMultiplier).to.equal(endingBalanceMultiplier)
      })

      it("balance multiplier should tick down at the correct rate during migration", async function() {
        const { indexToken, liquidityPool, nextLiquidityPool, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96, unprivileged0, startingTotalSupply } = await loadFixture(deployIndex)
        const startingBalanceMultiplier = await indexToken.balanceMultiplier()
        await indexToken.startMigration(
          nextLiquidityPool,
          minBalanceMultiplierChangeDelay,
          maxBalanceMultiplierChangePerSecondQ96
        )
        await increaseTime(Number(minBalanceMultiplierChangeDelay) + 1)
        var endingBalanceMultiplier = await indexToken.balanceMultiplier()
        var expectedMultiplier = (startingBalanceMultiplier * maxBalanceMultiplierChangePerSecondQ96) >> 96n
        expect(endingBalanceMultiplier).to.equal(expectedMultiplier)
        await increaseTime(1)
        endingBalanceMultiplier = await indexToken.balanceMultiplier()
        expectedMultiplier = (expectedMultiplier * maxBalanceMultiplierChangePerSecondQ96) >> 96n
        expect(endingBalanceMultiplier).to.be.closeTo(expectedMultiplier, 1n)
      })

      it("balance multiplier should not tick down during grace period", async function() {
        const { indexToken, liquidityPool, nextLiquidityPool, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96, unprivileged0, startingTotalSupply } = await loadFixture(deployIndex)
        await indexToken.startMigration(
          nextLiquidityPool,
          minBalanceMultiplierChangeDelay,
          maxBalanceMultiplierChangePerSecondQ96
        )
        const startingBalanceMultiplier = await indexToken.balanceMultiplier()
        await increaseTime(Number(minBalanceMultiplierChangeDelay) - 1)
        const endingBalanceMultiplier = await indexToken.balanceMultiplier()
        expect(startingBalanceMultiplier).to.equal(endingBalanceMultiplier)
      })
    })
  })

  describe("ERC20 Functionality", function() {
    describe("totalSupply", function() {
      it("should return the correct value", async function() {
        const { indexToken, liquidityPool, nextLiquidityPool, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96, unprivileged0, startingTotalSupply } = await loadFixture(deployIndex)
        expect(await indexToken.totalSupply()).to.equal(startingTotalSupply)
      })

      it("should change when the balance multiplier changes", async function() {
        const { indexToken, liquidityPool, nextLiquidityPool, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96, unprivileged0, startingTotalSupply } = await loadFixture(deployIndex)
        expect(await indexToken.totalSupply()).to.equal(startingTotalSupply)
        await indexToken.startMigration(
          nextLiquidityPool,
          minBalanceMultiplierChangeDelay,
          maxBalanceMultiplierChangePerSecondQ96
        )
        await increaseTime(Number(minBalanceMultiplierChangeDelay) + 1)

      })

      it("should increase when minting", async function() {

      })

      it("should decrease when burning", async function() {

      })
    })

    describe("balanceOf", function() {
      it("should return the correct value", async function() {
        const { indexToken, liquidityPool, nextLiquidityPool, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96, unprivileged0, startingTotalSupply } = await loadFixture(deployIndex)

      })

      it("should change when the balance multiplier ticks down", async function() {
        const { indexToken, liquidityPool, nextLiquidityPool, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96, unprivileged0, startingTotalSupply } = await loadFixture(deployIndex)

      })
    })

    describe("transfer", function() {
      it("should transfer the exact amount", async function() {
        const { indexToken, liquidityPool, nextLiquidityPool, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96, unprivileged0, startingTotalSupply } = await loadFixture(deployIndex)

      })
    })

    describe("allowance", function() {
      it("should return the allowance in visible units", async function() {
        const { indexToken, liquidityPool, nextLiquidityPool, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96, unprivileged0, startingTotalSupply } = await loadFixture(deployIndex)

      })

      it("allowance should not tick down with the balance multiplier", async function() {
        const { indexToken, liquidityPool, nextLiquidityPool, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96, unprivileged0, startingTotalSupply } = await loadFixture(deployIndex)

      })
    })

    describe("approve", function() {
      it("should set the allowance with the correct values", async function() {
        const { indexToken, liquidityPool, nextLiquidityPool, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96, unprivileged0, startingTotalSupply } = await loadFixture(deployIndex)

      })
    })

    describe("transferFrom", function() {
      it("should transfer the correct amount", async function() {
        const { indexToken, liquidityPool, nextLiquidityPool, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96, unprivileged0, startingTotalSupply } = await loadFixture(deployIndex)

      })

      it("should deduct the allowance by the correct amount", async function() {
        const { indexToken, liquidityPool, nextLiquidityPool, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96, unprivileged0, startingTotalSupply } = await loadFixture(deployIndex)

      })
    })

    describe("decimals", function() {
      it("should return the correct decimals", async function() {
        const { indexToken, liquidityPool, nextLiquidityPool, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96, unprivileged0, startingTotalSupply } = await loadFixture(deployIndex)

      })
    })

    describe("mint", function() {
      it("should mint the correct amount", async function() {
        const { indexToken, liquidityPool, nextLiquidityPool, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96, unprivileged0, startingTotalSupply } = await loadFixture(deployIndex)

      })

      it("should still work after a balance multiplier change", async function() {
        const { indexToken, liquidityPool, nextLiquidityPool, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96, unprivileged0, startingTotalSupply } = await loadFixture(deployIndex)

      })
    })

    describe("burnFrom", function() {
      it("should burn the correct amount", async function() {
        const { indexToken, liquidityPool, nextLiquidityPool, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96, unprivileged0, startingTotalSupply } = await loadFixture(deployIndex)

      })

      it("should still work after a balance multiplier change", async function() {
        const { indexToken, liquidityPool, nextLiquidityPool, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96, unprivileged0, startingTotalSupply } = await loadFixture(deployIndex)

      })
    })
  })
})