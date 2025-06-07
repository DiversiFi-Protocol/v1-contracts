const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const hre = require("hardhat");
const utils = require("./testModules/utils");

describe("PoolMath", function() {
  async function deployAll() {
    const poolMathWrapperFactory = await hre.ethers.getContractFactory("PoolMathWrapper");
    const poolMathWrapper = await poolMathWrapperFactory.deploy()
    return {poolMathWrapper};
  }

  describe("allocationToFixed", function() {
    const allocationBits = (utils.ALLOCATION_SHIFT-utils.SHIFT)*-1n
    it("should produce the expected number", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const halfUnscaled = 2n ** (allocationBits - 1n);//half of 1 scaled
      const halfScaled = await poolMathWrapper.allocationToFixed(halfUnscaled)
      expect(halfScaled).to.equal(halfUnscaled << utils.ALLOCATION_SHIFT)
    })
    
    it("math check", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const halfUnscaled = 2n ** (allocationBits - 1n);//half of 1 scaled
      const halfScaled = await poolMathWrapper.allocationToFixed(halfUnscaled)
      expect((halfScaled * 1000000n) >> utils.SHIFT).to.equal(500000n)
    })
  })

  describe("fixedToAllocation", function() {
    it("should convert back to original allocation", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const allocation = utils.formatAllocationFromDecimal(0.1)
      const fixed = await poolMathWrapper.allocationToFixed(allocation)
      const endingAlloc = await poolMathWrapper.fixedToAllocation(fixed)
      expect(endingAlloc).to.equal(allocation)
    })
  })

  describe("toFixed", function() {
    it("should convert to the expected number", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const oneScaled = utils.SCALE
      const result = await poolMathWrapper.toFixed(1n)
      expect(result).to.equal(oneScaled)
    })
  })

  describe("fromFixed", function() {
    it("should convert to and from fixed", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const startingNum = 42069n
      const scaled = await poolMathWrapper.toFixed(startingNum)
      const endingNum = await poolMathWrapper.fromFixed(scaled)
      expect(startingNum).to.equal(endingNum)
    })
  })

  describe("calcCompoundingFeeRate", function() {
    it("should calculate the correct compounding fee rate", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const baseRate = utils.decimalToFixed(0.01) // 1% base rate
      const expectedRate = (baseRate << utils.SHIFT) / (utils.SCALE - baseRate)
      const rate = await poolMathWrapper.calcCompoundingFeeRate(baseRate)
      expect(rate).to.equal(expectedRate)
    })
  })

  describe("scaleDecimals", function() {
    it("same amount of decimals", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const res = await poolMathWrapper.scaleDecimals(10n, 18n, 18n)
      expect(res).to.equal(10n)
    })

    it("increase decimals", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const res = await poolMathWrapper.scaleDecimals(10n, 18n, 20n)
      expect(res).to.equal(1000n)
    })

    it("decrease decimals", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const res = await poolMathWrapper.scaleDecimals(10n, 18n, 17n)
      expect(res).to.equal(1n)
    })
  })

  describe("calcMaxIndividualDelta", function() {
    it("should calculate the correct delta for a withdrawal from 0.5 to 0.25", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const totalReserves = utils.scale10Pow18(1_000_000n);
      const specificReserves = utils.scale10Pow18(500_000n);
      const targetAllocation = utils.formatAllocationFromDecimal(0.25);
      const delta = await poolMathWrapper.calcMaxIndividualDelta(
        targetAllocation,
        specificReserves,
        totalReserves
      )
      const specificReserves2 = specificReserves + delta
      const totalReserves2 = totalReserves + delta
      const allocation2 = utils.formatAllocationFromFixed((specificReserves2 << utils.SHIFT) / totalReserves2)
      expect(allocation2).to.be.closeTo(targetAllocation, targetAllocation / 2n ** 64n)
    })

    it("should calculate the correct delta for a withdrawal from 0.5 to 0", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const totalReserves = utils.scale10Pow18(1_000_000n);
      const specificReserves = utils.scale10Pow18(500_000n);
      const targetAllocation = 0n
      const delta = await poolMathWrapper.calcMaxIndividualDelta(
        targetAllocation,
        specificReserves,
        totalReserves
      )
      const specificReserves2 = specificReserves + delta
      const totalReserves2 = totalReserves + delta
      const allocation2 = utils.formatAllocationFromFixed((specificReserves2 << utils.SHIFT) / totalReserves2)
      expect(allocation2).to.be.closeTo(targetAllocation, targetAllocation / 2n ** 64n)
    })

    it("should calculate the correct delta for a deposit from 0.25 to 0.5", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const totalReserves = utils.scale10Pow18(1_000_000n);
      const specificReserves = utils.scale10Pow18(250_000n);
      const targetAllocation = utils.formatAllocationFromDecimal(0.5);
      const delta = await poolMathWrapper.calcMaxIndividualDelta(
        targetAllocation,
        specificReserves,
        totalReserves
      )
      const specificReserves2 = specificReserves + delta
      const totalReserves2 = totalReserves + delta
      const allocation2 = utils.formatAllocationFromFixed((specificReserves2 << utils.SHIFT) / totalReserves2)
      expect(allocation2).to.be.closeTo(targetAllocation, targetAllocation / 2n ** 64n)
    })

    it("should calculate the correct delta for a deposit from 0 to 0.5", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const totalReserves = utils.scale10Pow18(1_000_000n);
      const specificReserves = 0n
      const targetAllocation = utils.formatAllocationFromDecimal(0.5);
      const delta = await poolMathWrapper.calcMaxIndividualDelta(
        targetAllocation,
        specificReserves,
        totalReserves
      )
      const specificReserves2 = specificReserves + delta
      const totalReserves2 = totalReserves + delta
      const allocation2 = utils.formatAllocationFromFixed((specificReserves2 << utils.SHIFT) / totalReserves2)
      expect(allocation2).to.be.closeTo(targetAllocation, targetAllocation / 2n ** 64n)
    })
  })

  describe("calcEqualizationBounty", function() {
    it("should return 0 if the bounty is 0", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll)
      const totalBounty = utils.scale10Pow18(0n)
      const startingDiscrepency = utils.scale10Pow18(1_000_000n)
      const endingDiscrepency = 0n
      const bounty = await poolMathWrapper.calcEqualizationBounty(
        totalBounty, startingDiscrepency, endingDiscrepency
      )
      expect(bounty).to.equal(0n)
    })

    it("should error if the discrepency is increasing", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll)
      const totalBounty = utils.scale10Pow18(1_000n)
      const startingDiscrepency = utils.scale10Pow18(10n)
      const endingDiscrepency = utils.scale10Pow18(10n) + 1n
      await expect(
        poolMathWrapper.calcEqualizationBounty(totalBounty, startingDiscrepency, endingDiscrepency)
      ).to.be.revertedWithPanic("0x11")
    })

    it("should return half the bounty for resolving half the discrepency", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll)
      const totalBounty = utils.scale10Pow18(1_000n)
      const startingDiscrepency = utils.scale10Pow18(1_000_000n)
      const endingDiscrepency = startingDiscrepency / 2n
      const bounty = await poolMathWrapper.calcEqualizationBounty(
        totalBounty, startingDiscrepency, endingDiscrepency
      )
      expect(bounty).to.equal(totalBounty / 2n)
    })

    it("should return the entire bounty for resolving the entire discrepency", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll)
      const totalBounty = utils.scale10Pow18(1_000n)
      const startingDiscrepency = utils.scale10Pow18(1_000_000n)
      const endingDiscrepency = 0n
      const bounty = await poolMathWrapper.calcEqualizationBounty(
        totalBounty, startingDiscrepency, endingDiscrepency
      )
      expect(bounty).to.equal(totalBounty)
    })
  })
})