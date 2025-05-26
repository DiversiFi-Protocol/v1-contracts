const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const hre = require("hardhat");
const utils = require("./testModules/utils");

const TOLERANCE = 1_000_000
const tolerance = (val) => {
  return val / TOLERANCE
}

describe("PoolMath", function() {
  async function deployAll() {
    const poolMathLibraryFactory = await hre.ethers.getContractFactory("PoolMath")
    const poolMathLibrary = await poolMathLibraryFactory.deploy()
    const poolMathWrapperFactory = await hre.ethers.getContractFactory("PoolMathWrapper", {
      libraries: {
        PoolMath: poolMathLibrary.target
      }
    });
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
      const specificReserves = 1000000000000000000n
      const totalReserves =    10000000000000000000n
      const fixed = await poolMathWrapper.allocationToFixed(allocation)
      const endingAlloc = await poolMathWrapper.fixedToAllocation(fixed, specificReserves, totalReserves)
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
      const baseRate = 0.01
      const compoundingFrequency = 365
      const expectedRate = (1 + baseRate) ** compoundingFrequency - 1
      const rate = await poolMathWrapper.calcCompoundingFeeRate(baseRate, compoundingFrequency)
      expect(rate).to.be.closeTo(expectedRate, tolerance(expectedRate))
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
})