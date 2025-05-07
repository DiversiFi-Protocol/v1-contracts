const { time, loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const hre = require("hardhat");
const { getAddress, parseGwei, getCreateAddress } = require("viem");
const utils = require("./testModules/utils");
const finalFunctions = require("./testModules/finalFunctions")

const TOLERANCE = 1_000_000
const tolerance = (val) => {
  return val / TOLERANCE
}


describe("PoolMath", function() {
  const ONE_HUNDRED_MILLIONTH_STRING = "0.000001";
  const ONE_MILLIONTH =         0.000001;
  const ONE_HUNDRED_MILLIONTH = 0.00000001;
  const SCALE = 2n ** 128n;
  const SHIFT = 128n;
  const randAddress0 = getAddress("0x4838B106FCe9647Bdf1E7877BF73cE8B0BAD5f97")
  const randAddress1 = getAddress("0xDD2A0e78Da596bf380E899Ca7C89B39857122Ae6")
  const randAddress2 = getAddress("0xC6093Fd9cc143F9f058938868b2df2daF9A91d28")

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

  describe("naturalLog", function() {
    const testAccuracy = (trueVal, testVal, toleranceRatio) => {
      const min = trueVal - (trueVal * toleranceRatio)
      const max = trueVal + (trueVal * toleranceRatio)
      //console.log("test:", testVal, "true", trueVal, "diff:", trueVal - testVal)
      if (testVal >= min && testVal <= max) {
        return true
      } else {
        return false
      }
    }
    const e = utils.decimalToFixed(Math.E)
    it("ln of e should be 1", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const result = await poolMathWrapper.lnQ128(e)
      console.log(utils.fixedToDecimal(result))
    })
  })

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

  describe("getTickLowerBoundIndex", function() {
    const lowerBound = {
      allocation: 0.05,
      price: 1.01,
      increaseFee: 0.0001,
      decreaseFee: 0.0001
    };
    const middleBound = {
      allocation: 0.1,
      price: 1,
      increaseFee: 0.0001,
      decreaseFee: 0.0001
    };
    const upperBound = {
      allocation: 0.2,
      price: 0.99,
      increaseFee: 0.0001,
      decreaseFee: 0.0001
    }
    const assetParams = utils.createAssetParams(
      18,
      middleBound.allocation,
      upperBound.allocation,
      [lowerBound, middleBound, upperBound],
    );
    const totalReserves = 1000000n

    it("middle of range", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const middle0 = utils.decimalToFixed(lowerBound.allocation + middleBound.allocation) / 2n
      const middle1 = utils.decimalToFixed(upperBound.allocation + middleBound.allocation) / 2n
      const specificReserves0 = totalReserves * middle0 / utils.SCALE
      const specificReserves1 = totalReserves * middle1 / utils.SCALE
      // //console.log("assetParams:", assetParams)
      const res0 = await poolMathWrapper.getTickLowerBoundIndex(
        assetParams,
        specificReserves0,
        totalReserves
      )
      const res1 = await poolMathWrapper.getTickLowerBoundIndex(
        assetParams,
        specificReserves1,
        totalReserves
      )

      expect(res0).to.equal(0n, "incorrect lower bound index0")
      expect(res1).to.equal(1n, "incorrect lower bound index1")
    })

    it("bottom edge of range", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const lowerAlloc = utils.decimalToFixed(lowerBound.allocation)
      const specificReserves0 = totalReserves * lowerAlloc / utils.SCALE
      const res0 = await poolMathWrapper.getTickLowerBoundIndex(
        assetParams,
        specificReserves0,
        totalReserves
      )
      expect(res0).to.equal(0n)
    })

    it("above max range should return highest tick index without error", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const res0 = await poolMathWrapper.getTickLowerBoundIndex(
        assetParams,
        totalReserves,
        totalReserves
      )
      expect(res0).to.equal(1n)
    })

    it("below min range should return lowest tick index without error", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const res0 = await poolMathWrapper.getTickLowerBoundIndex(
        assetParams,
        1n,
        totalReserves
      )
      expect(res0).to.equal(0n)
    })
    
    it("edge of tick in middle of range", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const middleAlloc = utils.decimalToFixed(middleBound.allocation)
      const specificReserves0 = totalReserves * middleAlloc / utils.SCALE
      const res0 = await poolMathWrapper.getTickLowerBoundIndex(
        assetParams,
        specificReserves0,
        totalReserves
      )
      expect(res0).to.equal(1n)
    })

    it("zero", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const res0 = await poolMathWrapper.getTickLowerBoundIndex(
        assetParams,
        0n,
        totalReserves
      )
      expect(res0).to.equal(0n)
    })

    it("edge of the final tick in range", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const maxAlloc = utils.decimalToFixed(upperBound.allocation)
      const specificReserves0 = totalReserves * maxAlloc / utils.SCALE
      const res0 = await poolMathWrapper.getTickLowerBoundIndex(
        assetParams,
        specificReserves0,
        totalReserves
      )
      expect(res0).to.equal(1n)
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

  describe.skip("scaleDecimals18", function() {
    it("eq 18", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const res = await poolMathWrapper.scaleDecimals18(1000n, 18n)
      expect(res).to.equal(1000n)
    })

    it("gt 18", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const res = await poolMathWrapper.scaleDecimals18(1000n, 20n)
      expect(res).to.equal(10n)
    })

    it("lt 18", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const res = await poolMathWrapper.scaleDecimals18(1000n, 16n)
      expect(res).to.equal(100000n)
    })
  })

  describe("log2Q128", function() {
    it("basic test", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const mil = utils.decimalToFixed(1000)
      const res = await poolMathWrapper.log2Q128(mil)
      console.log(utils.fixedToDecimal(res))
    })
  })

  describe("lnQ128", function() {
    it("basic test", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const mil = utils.decimalToFixed(0.1)
      const res = await poolMathWrapper.lnQ128(mil)
      console.log(utils.fixedToDecimal(res))
    })
  })

  describe.skip("unscaleDecimals18", function() {
    it("eq 18", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const res = await poolMathWrapper.unscaleDecimals18(1000n, 18n)
      expect(res).to.equal(1000n)
    })

    it("gt 18", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const res = await poolMathWrapper.unscaleDecimals18(1000n, 20n)
      expect(res).to.equal(100000n)
    })

    it("lt 18", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const res = await poolMathWrapper.unscaleDecimals18(1000n, 16n)
      expect(res).to.equal(10n)
    })
  })

  describe("maxAllocationCheck", function() {
    it("should not error when below max allocation", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const allocation = utils.formatAllocationFromDecimal(0.1)
      const specificReserves = 1000000000000000000n
      const totalReserves =    10000000000000000000n
      await poolMathWrapper.maxAllocationCheck(allocation, specificReserves, totalReserves)
    })

    it("should error when above max allocation", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const allocation = utils.formatAllocationFromDecimal(0.0999)
      const specificReserves = 1000000000000000000n
      const totalReserves =    10000000000000000000n
      await expect(
        poolMathWrapper.maxAllocationCheck(allocation, specificReserves, totalReserves)
      ).to.be.revertedWith("reserves gt max alloc")
    })

    it("shouldn't overflow when allocation is max", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const allocation = 2n ** 32n - 1n
      const specificReserves = 1000000000000000000n
      const totalReserves =    10000000000000000000n
      await poolMathWrapper.maxAllocationCheck(allocation, specificReserves, totalReserves)
    })
  })

  describe("minAllocationCheck", function() {
    it("should not error when above min allocation", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const allocation = utils.formatAllocationFromDecimal(0.00999)
      const specificReserves = 1000000000000000000n
      const totalReserves =    10000000000000000000n
      await poolMathWrapper.minAllocationCheck(allocation, specificReserves, totalReserves)
    })

    it("should error when above max allocation", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const allocation = utils.formatAllocationFromDecimal(0.1005)
      const specificReserves = 1000000000000000000n
      const totalReserves =    10000000000000000000n
      await expect(
        poolMathWrapper.minAllocationCheck(allocation, specificReserves, totalReserves)
      ).to.be.revertedWith("reserves lt min alloc")
    })

    it("shouldn't underflow when allocation is zero", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const allocation = 0
      const specificReserves = 1000000000000000000n
      const totalReserves =    10000000000000000000n
      await poolMathWrapper.minAllocationCheck(allocation, specificReserves, totalReserves)
    })
  })

  describe("calcPrice", function() {
    const lowerBound = {
      allocation: 0.1,
      price: 1.01,
      increaseFee: 0,
      decreaseFee: 0
    };
    const upperBound = {
      allocation: 0.2,
      price: 0.99,
      increaseFee: 0,
      decreaseFee: 0
    }

    const testTick = utils.createTickData(upperBound, lowerBound)

    it("middle of tick", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const totalReserves = 1000000000000000000n
      const allocation = utils.decimalToFixed(0.15)
      const specificReserves = allocation * totalReserves / utils.SCALE
      const res = await poolMathWrapper.calcPrice(testTick, specificReserves, totalReserves)
      const expectedPrice = 1
      expect(utils.fixedToDecimal(res)).to.be.closeTo(expectedPrice, tolerance(expectedPrice))
    })

    it("lower edge of tick", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const totalReserves = 1000000000000000000n
      const allocation = utils.scaleAllocation(testTick.allocation)
      const specificReserves = allocation * totalReserves / utils.SCALE
      const res = await poolMathWrapper.calcPrice(testTick, specificReserves, totalReserves)
      const expectedPrice = 1.01
      expect(utils.fixedToDecimal(res)).to.be.closeTo(expectedPrice, tolerance(expectedPrice))
    })

    it("upper edge of tick", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const totalReserves = 1000000000000000000n
      const allocation = utils.scaleAllocation(utils.formatAllocationFromDecimal(0.2))
      const specificReserves = allocation * totalReserves / utils.SCALE - 1n
      const res = await poolMathWrapper.calcPrice(testTick, specificReserves, totalReserves)
      const expectedPrice = 0.99
      expect(utils.fixedToDecimal(res)).to.be.closeTo(expectedPrice, tolerance(expectedPrice))
    })

    it("below lower tick should error", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const totalReserves = 1000000000000000000n
      const allocation = utils.scaleAllocation(testTick.allocation)
      const specificReserves = allocation * totalReserves / utils.SCALE - 1n
      await expect (
        poolMathWrapper.calcPrice(testTick, specificReserves, totalReserves)
      ).to.be.revertedWith("reserves below tick domain")
    })

    it("on upper tick should error", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const totalReserves = 1000000000000000000n
      const allocation = utils.scaleAllocation(utils.formatAllocationFromDecimal(0.2))
      const specificReserves = allocation * totalReserves / utils.SCALE
      await expect(
        poolMathWrapper.calcPrice(testTick, specificReserves, totalReserves)
      ).to.be.revertedWith("reserves above tick domain")
    })
  })

  describe("calcStepMaxWithdrawal", function() {
    const testNearAllocationEdge = (
      _allocation,
      specificReserves,
      totalReserves
    ) => {
      const allocation = utils.scaleAllocation(_allocation)
      const allocationInUnits = (allocation * totalReserves) >> SHIFT;
      //console.log("specificReserves:", specificReserves, "totalReserves:", totalReserves, "allocationBoundaryUnits:", allocationInUnits, "allocation:", utils.fixedToDecimal(allocation))
      expect(specificReserves).to.be.lessThanOrEqual(allocationInUnits + 2n, "specific reserves should be no greater than 2 units above the allocation boundary")
      expect(specificReserves).to.be.greaterThanOrEqual(allocationInUnits -2n, "specific reserves should be no less than 2 units below the allocation boundary")
    }

    const allocationFormatted = utils.formatAllocationFromDecimal(0.1)
    const allocationTrue = utils.scaleAllocation(allocationFormatted)
    const totalReserves = 1000000000000000000n //1 with 18 decimal places

    it("should calculate the exact max withdrawal in the middle of the tick", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const specificReservesAllocation = utils.scaleAllocation(utils.formatAllocationFromDecimal(0.2))
      const startingReserves = (specificReservesAllocation * totalReserves) >> SHIFT
      const maxWithdrawal = await poolMathWrapper.calcStepMaxWithdrawal(allocationFormatted, startingReserves, totalReserves)
      const endingSpecificReserves = startingReserves - maxWithdrawal
      const endingTotalReserves = totalReserves - maxWithdrawal
      testNearAllocationEdge(allocationFormatted, endingSpecificReserves, endingTotalReserves)
    })

    it("should work on the bottom of the tick (to put the reserves in the domain of the next tick)", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const specificReserves = allocationTrue * totalReserves >> utils.SHIFT
      const maxWithdrawal = await poolMathWrapper.calcStepMaxWithdrawal(
        allocationFormatted,
        specificReserves,
        totalReserves
      )
      testNearAllocationEdge(
        allocationFormatted,
        specificReserves - maxWithdrawal,
        totalReserves - maxWithdrawal
      )
    })

    it("special case that may cause error due to rounding", async function() {
      //as of writing the current inacuracy of calcStepMaxWithdrawal is always off by 2,
      //one is because it should exceed the allocation by 1, so 1 is added to the final result
      //two, I think is because the final result is always rounding down
      //if numerator divides perfectly into denominator there should be no rounding
      const { poolMathWrapper } = await loadFixture(deployAll);
      const totalReserves = 1000000000000n
      const halfAllocation = utils.formatAllocationFromDecimal(0.5)
      const specificReserves = 750000000000n
      const maxWithdrawal = await poolMathWrapper.calcStepMaxWithdrawal(
        halfAllocation,
        specificReserves,
        totalReserves
      )
      const specificReservesAfter = specificReserves - maxWithdrawal;
      const totalReservesAfter = totalReserves - maxWithdrawal;
      const minSpecificReservesInRangeOfTick = utils.scaleAllocation(halfAllocation) * totalReservesAfter >> utils.SHIFT
      //console.log("minSpec", minSpecificReservesInRangeOfTick)
      //console.log("spec:", specificReservesAfter)
      //console.log("totalReservesAfter:", totalReservesAfter)
      testNearAllocationEdge(halfAllocation, specificReservesAfter, totalReservesAfter)
    })

    it("should error when below the allocation", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      await expect(
        poolMathWrapper.calcStepMaxWithdrawal(
          allocationFormatted,
          0n,
          totalReserves
        )
      ).to.be.revertedWithPanic()
    })

    it("should return 0 on the bottom of the tick if the allocation is zero", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const zeroAllocation = 0n
      const maxWithdrawal = await poolMathWrapper.calcStepMaxWithdrawal(zeroAllocation, 0n, totalReserves)
      expect(maxWithdrawal).to.equal(0n)
    })

    it("should return whatever the remaining specific reserves are if the allocation is zero", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const zeroAllocation = 0n
      const specificReserves = 69420n
      const maxWithdrawal = await poolMathWrapper.calcStepMaxWithdrawal(zeroAllocation, specificReserves, totalReserves)
      expect(maxWithdrawal).to.equal(specificReserves)
    })
  })

  describe("calcStepMaxDeposit", function() {
    const testNearAllocationEdge = (
      _allocation,
      specificReserves,
      totalReserves
    ) => {
      const allocation = utils.scaleAllocation(_allocation)
      const allocationInUnits = (allocation * totalReserves) >> SHIFT;
      //console.log("specificReserves:", specificReserves, "totalReserves:", totalReserves, "allocationBoundaryUnits:", allocationInUnits, "allocation:", utils.fixedToDecimal(allocation))
      expect(specificReserves).to.be.lessThanOrEqual(allocationInUnits + 2n, "specific reserves should be no greater than 2 units above the allocation boundary")
      expect(specificReserves).to.be.greaterThanOrEqual(allocationInUnits -2n, "specific reserves should be no less than 2 units below the allocation boundary")
    }

    const allocationFormatted = utils.formatAllocationFromDecimal(0.1)
    const allocationTrue = utils.scaleAllocation(allocationFormatted)
    const totalReserves = 1000000000000000000n //1 with 18 decimal places

    it("should calculate the exact max deposit in the middle of the tick", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const startingAllocation = utils.scaleAllocation(utils.formatAllocationFromDecimal(0.05))
      const startingReserves = (startingAllocation * totalReserves) >> SHIFT
      const maxDeposit = await poolMathWrapper.calcStepMaxDeposit(allocationFormatted, startingReserves, totalReserves)
      const endingSpecificReserves = startingReserves + maxDeposit
      const endingTotalReserves = totalReserves + maxDeposit
      testNearAllocationEdge(allocationFormatted, endingSpecificReserves, endingTotalReserves)
    })

    it("should return 1 on the top of the tick (to put the reserves in the domain of the next tick)", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const startingSpecificReserves = ((allocationTrue * totalReserves) >> SHIFT) - 1n
      const maxDeposit = await poolMathWrapper.calcStepMaxDeposit(allocationFormatted, startingSpecificReserves, totalReserves)
      const endingSpecificReserves = startingSpecificReserves + maxDeposit
      const endingTotalReserves = totalReserves + maxDeposit
      // expect(maxDeposit).to.equal(1n)
      //console.log("maxDeposit:", maxDeposit)
      testNearAllocationEdge(allocationFormatted, endingSpecificReserves, endingTotalReserves)
    })

    it("should error when above the allocation", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const startingReserves = ((allocationTrue * totalReserves) >> SHIFT)
      await expect(
        poolMathWrapper.calcStepMaxDeposit(allocationFormatted, startingReserves+1n, totalReserves)
      ).to.be.revertedWithPanic()
    })

    it("should return max uint256 is the allocation is 1", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      expect(
        await poolMathWrapper.calcStepMaxDeposit(2n ** 32n - 1n, 1n, totalReserves)
      ).to.equal(2n ** 256n - 1n)
    })
  })

  describe("calcStepMint", function() {
    const totalReserves =    1000000000000000000n//1e^18
    const specificReserves = 100000000000000000n//0.1e^18
    const depositAmount =    10000000000000000n//0.01e^18
    it("price=1, slope=0, increaseFee=0", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const allocation = utils.formatAllocationFromDecimal(0.1)
      const nextAllocation = utils.formatAllocationFromDecimal(0.2)
      const price = utils.formatPriceFromDecimal(1)
      const increaseFee = utils.formatFeeFromDecimal(0)
      const decreaseFee = utils.formatFeeFromDecimal(0)
      const priceSlope = utils.formatPriceSlopeFromDecimal(0)

      const tick = {
        allocation: allocation,
        nextAllocation: nextAllocation,
        price: price,
        increaseFee: increaseFee,
        decreaseFee: decreaseFee,
        priceSlope: priceSlope,
      }

      const [mintAmount, fee] = await poolMathWrapper.calcStepMint(
        depositAmount,
        totalReserves,
        specificReserves,
        tick
      )
      expect(mintAmount).to.equal(depositAmount);
      expect(fee).to.equal(0n)
    })

    it("price=1.1, slope=0, increaseFee=0", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const allocation = utils.formatAllocationFromDecimal(0.1)
      const nextAllocation = utils.formatAllocationFromDecimal(0.2)
      const price = utils.formatPriceFromDecimal(1.1)
      const increaseFee = utils.formatFeeFromDecimal(0)
      const decreaseFee = utils.formatFeeFromDecimal(0)
      const priceSlope = utils.formatPriceSlopeFromDecimal(0)

      const tick = {
        allocation: allocation,
        nextAllocation: nextAllocation,
        price: price,
        increaseFee: increaseFee,
        decreaseFee: decreaseFee,
        priceSlope: priceSlope,
      }

      const [mintAmount, fee] = await poolMathWrapper.calcStepMint(
        depositAmount,
        totalReserves,
        specificReserves,
        tick
      )
      expect(mintAmount).to.equal(depositAmount * utils.scalePrice(price) >> utils.SHIFT);
      expect(fee).to.equal(0n)
    })
    
    it("price=1, slope=1, increaseFee=0", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const allocation = utils.formatAllocationFromDecimal(0.1)
      const nextAllocation = utils.formatAllocationFromDecimal(0.2)
      const price = utils.formatPriceFromDecimal(1)
      const increaseFee = utils.formatFeeFromDecimal(0)
      const decreaseFee = utils.formatFeeFromDecimal(0)
      const priceSlope = utils.formatPriceSlopeFromDecimal(1)

      const tick = {
        allocation: allocation,
        nextAllocation: nextAllocation,
        price: price,
        increaseFee: increaseFee,
        decreaseFee: decreaseFee,
        priceSlope: priceSlope,
      }

      const [mintAmount, fee] = await poolMathWrapper.calcStepMint(
        depositAmount,
        totalReserves,
        specificReserves,
        tick
      )

      const { output: mintAmountTrue, fee: feeTrue } = finalFunctions.outGivenInDeposit(
        depositAmount,
        specificReserves,
        totalReserves,
        tick
      )
      expect(Number(mintAmount)).to.be.closeTo(mintAmountTrue, ONE_HUNDRED_MILLIONTH * mintAmountTrue)
      expect(fee).to.equal(feeTrue)
    })

    it("price=1, slope=0, increaseFee=0.1", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const allocation = utils.formatAllocationFromDecimal(0.1)
      const nextAllocation = utils.formatAllocationFromDecimal(0.2)
      const price = utils.formatPriceFromDecimal(1)
      const increaseFee = utils.formatFeeFromDecimal(0.1)
      const decreaseFee = utils.formatFeeFromDecimal(0)
      const priceSlope = utils.formatPriceSlopeFromDecimal(0)

      const tick = {
        allocation: allocation,
        nextAllocation: nextAllocation,
        price: price,
        increaseFee: increaseFee,
        decreaseFee: decreaseFee,
        priceSlope: priceSlope,
      }

      const [mintAmount, fee] = await poolMathWrapper.calcStepMint(
        depositAmount,
        totalReserves,
        specificReserves,
        tick
      )

      const { output: mintAmountTrue, fee: feeTrue } = finalFunctions.outGivenInDeposit(
        depositAmount,
        specificReserves,
        totalReserves,
        tick
      )
      expect(Number(mintAmount)).to.be.closeTo(mintAmountTrue, ONE_HUNDRED_MILLIONTH * mintAmountTrue)
      expect(fee).to.equal(feeTrue)
    })

    it("price=0.9, slope=1, increaseFee=0.01", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const allocation = utils.formatAllocationFromDecimal(0.1)
      const nextAllocation = utils.formatAllocationFromDecimal(0.2)
      const price = utils.formatPriceFromDecimal(0.9)
      const increaseFee = utils.formatFeeFromDecimal(0.01)
      const decreaseFee = utils.formatFeeFromDecimal(0)
      const priceSlope = utils.formatPriceSlopeFromDecimal(1)

      const tick = {
        allocation: allocation,
        nextAllocation: nextAllocation,
        price: price,
        increaseFee: increaseFee,
        decreaseFee: decreaseFee,
        priceSlope: priceSlope,
      }

      const [mintAmount, fee] = await poolMathWrapper.calcStepMint(
        depositAmount,
        totalReserves,
        specificReserves,
        tick
      )

      const { output: mintAmountTrue, fee: feeTrue } = finalFunctions.outGivenInDeposit(
        depositAmount,
        specificReserves,
        totalReserves,
        tick
      )
      expect(Number(mintAmount)).to.be.closeTo(mintAmountTrue, ONE_HUNDRED_MILLIONTH * mintAmountTrue)
      expect(fee).to.equal(feeTrue)
    })
  })

  describe("calcStepDeposit", function() {
    const totalReserves =    1000000000000000000n//1e^18
    const specificReserves = 100000000000000000n//0.1e^18
    const mintAmount =    10000000000000000n//0.01e^18
    it("price=1, slope=0, increaseFee=0", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const allocation = utils.formatAllocationFromDecimal(0.1)
      const nextAllocation = utils.formatAllocationFromDecimal(0.2)
      const price = utils.formatPriceFromDecimal(1)
      const increaseFee = utils.formatFeeFromDecimal(0)
      const decreaseFee = utils.formatFeeFromDecimal(0)
      const priceSlope = utils.formatPriceSlopeFromDecimal(0)

      const tick = {
        allocation: allocation,
        nextAllocation: nextAllocation,
        price: price,
        increaseFee: increaseFee,
        decreaseFee: decreaseFee,
        priceSlope: priceSlope,
      }

      const [depositAmount, fee] = await poolMathWrapper.calcStepDeposit(
        mintAmount,
        totalReserves,
        specificReserves,
        tick
      )
      expect(depositAmount).to.equal(depositAmount);
      expect(fee).to.equal(0n)
    })

    it("price=1.1, slope=0, increaseFee=0", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const allocation = utils.formatAllocationFromDecimal(0.1)
      const nextAllocation = utils.formatAllocationFromDecimal(0.2)
      const price = utils.formatPriceFromDecimal(1.1)
      const increaseFee = utils.formatFeeFromDecimal(0)
      const decreaseFee = utils.formatFeeFromDecimal(0)
      const priceSlope = utils.formatPriceSlopeFromDecimal(0)

      const tick = {
        allocation: allocation,
        nextAllocation: nextAllocation,
        price: price,
        increaseFee: increaseFee,
        decreaseFee: decreaseFee,
        priceSlope: priceSlope,
      }

      const [depositAmount, fee] = await poolMathWrapper.calcStepDeposit(
        mintAmount,
        totalReserves,
        specificReserves,
        tick
      )
      expect(depositAmount).to.equal((mintAmount << utils.SHIFT) / utils.scalePrice(price));
      expect(fee).to.equal(0n)
    })
    
    it("price=1, slope=1, increaseFee=0", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const allocation = utils.formatAllocationFromDecimal(0.1)
      const nextAllocation = utils.formatAllocationFromDecimal(0.2)
      const price = utils.formatPriceFromDecimal(1)
      const increaseFee = utils.formatFeeFromDecimal(0)
      const decreaseFee = utils.formatFeeFromDecimal(0)
      const priceSlope = utils.formatPriceSlopeFromDecimal(1)

      const tick = {
        allocation: allocation,
        nextAllocation: nextAllocation,
        price: price,
        increaseFee: increaseFee,
        decreaseFee: decreaseFee,
        priceSlope: priceSlope,
      }

      const [depositAmount, fee] = await poolMathWrapper.calcStepDeposit(
        mintAmount,
        totalReserves,
        specificReserves,
        tick
      )

      const { input: depositAmountTrue, fee: feeTrue } = finalFunctions.inGivenOutDeposit(
        mintAmount,
        specificReserves,
        totalReserves,
        tick
      )
      expect(Number(depositAmount)).to.be.closeTo(depositAmountTrue, ONE_HUNDRED_MILLIONTH * depositAmountTrue)
      expect(fee).to.equal(feeTrue)
    })

    it("price=1, slope=0, increaseFee=0.1", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const allocation = utils.formatAllocationFromDecimal(0.1)
      const nextAllocation = utils.formatAllocationFromDecimal(0.2)
      const price = utils.formatPriceFromDecimal(1)
      const increaseFee = utils.formatFeeFromDecimal(0.1)
      const decreaseFee = utils.formatFeeFromDecimal(0)
      const priceSlope = utils.formatPriceSlopeFromDecimal(0)

      const tick = {
        allocation: allocation,
        nextAllocation: nextAllocation,
        price: price,
        increaseFee: increaseFee,
        decreaseFee: decreaseFee,
        priceSlope: priceSlope,
      }

      const [depositAmount, fee] = await poolMathWrapper.calcStepDeposit(
        mintAmount,
        totalReserves,
        specificReserves,
        tick
      )

      const { input: depositAmountTrue, fee: feeTrue } = finalFunctions.inGivenOutDeposit(
        mintAmount,
        specificReserves,
        totalReserves,
        tick
      )
      expect(Number(depositAmount)).to.be.closeTo(depositAmountTrue, ONE_HUNDRED_MILLIONTH * depositAmountTrue)
      expect(fee).to.equal(feeTrue)
    })

    it("price=0.9, slope=1, increaseFee=0.01", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const allocation = utils.formatAllocationFromDecimal(0.1)
      const nextAllocation = utils.formatAllocationFromDecimal(0.2)
      const price = utils.formatPriceFromDecimal(0.9)
      const increaseFee = utils.formatFeeFromDecimal(0.01)
      const decreaseFee = utils.formatFeeFromDecimal(0)
      const priceSlope = utils.formatPriceSlopeFromDecimal(1)

      const tick = {
        allocation: allocation,
        nextAllocation: nextAllocation,
        price: price,
        increaseFee: increaseFee,
        decreaseFee: decreaseFee,
        priceSlope: priceSlope,
      }

      const [depositAmount, fee] = await poolMathWrapper.calcStepDeposit(
        mintAmount,
        totalReserves,
        specificReserves,
        tick
      )

      const { input: depositAmountTrue, fee: feeTrue } = finalFunctions.inGivenOutDeposit(
        mintAmount,
        specificReserves,
        totalReserves,
        tick
      )
      expect(Number(depositAmount)).to.be.closeTo(depositAmountTrue, ONE_HUNDRED_MILLIONTH * depositAmountTrue)
      expect(fee).to.equal(feeTrue)
    })
  })

  describe("calcStepWithdraw", function() {
    const totalReserves =    1000000000000000000n//1e^18
    const specificReserves = 120000000000000000n//0.12e^18
    const burnAmount =       10000000000000000n//0.01e^18
    it("price=1, slope=0, increaseFee=0", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const allocation = utils.formatAllocationFromDecimal(0.1)
      const nextAllocation = utils.formatAllocationFromDecimal(0.2)
      const price = utils.formatPriceFromDecimal(1)
      const increaseFee = utils.formatFeeFromDecimal(0)
      const decreaseFee = utils.formatFeeFromDecimal(0)
      const priceSlope = utils.formatPriceSlopeFromDecimal(0)

      const tick = {
        allocation: allocation,
        nextAllocation: nextAllocation,
        price: price,
        increaseFee: increaseFee,
        decreaseFee: decreaseFee,
        priceSlope: priceSlope,
      }

      const [withdrawAmount, fee] = await poolMathWrapper.calcStepWithdrawal(
        burnAmount,
        totalReserves,
        specificReserves,
        tick
      )
      expect(withdrawAmount).to.equal(burnAmount);
      expect(fee).to.equal(0n)
    })

    it("price=1.1, slope=0, increaseFee=0", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const allocation = utils.formatAllocationFromDecimal(0.1)
      const nextAllocation = utils.formatAllocationFromDecimal(0.2)
      const price = utils.formatPriceFromDecimal(1.1)
      const increaseFee = utils.formatFeeFromDecimal(0)
      const decreaseFee = utils.formatFeeFromDecimal(0)
      const priceSlope = utils.formatPriceSlopeFromDecimal(0)

      const tick = {
        allocation: allocation,
        nextAllocation: nextAllocation,
        price: price,
        increaseFee: increaseFee,
        decreaseFee: decreaseFee,
        priceSlope: priceSlope,
      }

      const [withdrawAmount, fee] = await poolMathWrapper.calcStepWithdrawal(
        burnAmount,
        totalReserves,
        specificReserves,
        tick
      )
      expect(withdrawAmount).to.equal((burnAmount << utils.SHIFT) / utils.scalePrice(price));
      expect(fee).to.equal(0n)
    })
    
    it("price=1, slope=1, increaseFee=0", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const allocation = utils.formatAllocationFromDecimal(0.1)
      const nextAllocation = utils.formatAllocationFromDecimal(0.2)
      const price = utils.formatPriceFromDecimal(1)
      const increaseFee = utils.formatFeeFromDecimal(0)
      const decreaseFee = utils.formatFeeFromDecimal(0)
      const priceSlope = utils.formatPriceSlopeFromDecimal(1)

      const tick = {
        allocation: allocation,
        nextAllocation: nextAllocation,
        price: price,
        increaseFee: increaseFee,
        decreaseFee: decreaseFee,
        priceSlope: priceSlope,
      }

      const [withdrawAmount, fee] = await poolMathWrapper.calcStepWithdrawal(
        burnAmount,
        totalReserves,
        specificReserves,
        tick
      )

      const { output: withdrawAmountTrue, fee: feeTrue } = finalFunctions.outGivenInWithdraw(
        burnAmount,
        specificReserves,
        totalReserves,
        tick
      )
      expect(Number(withdrawAmount)).to.be.closeTo(withdrawAmountTrue, ONE_HUNDRED_MILLIONTH * withdrawAmountTrue)
      expect(fee).to.equal(feeTrue)
    })

    it("price=1, slope=0, increaseFee=0.1", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const allocation = utils.formatAllocationFromDecimal(0.1)
      const nextAllocation = utils.formatAllocationFromDecimal(0.2)
      const price = utils.formatPriceFromDecimal(1)
      const increaseFee = utils.formatFeeFromDecimal(0.1)
      const decreaseFee = utils.formatFeeFromDecimal(0)
      const priceSlope = utils.formatPriceSlopeFromDecimal(0)

      const tick = {
        allocation: allocation,
        nextAllocation: nextAllocation,
        price: price,
        increaseFee: increaseFee,
        decreaseFee: decreaseFee,
        priceSlope: priceSlope,
      }

      const [withdrawAmount, fee] = await poolMathWrapper.calcStepWithdrawal(
        burnAmount,
        totalReserves,
        specificReserves,
        tick
      )

      const { output: withdrawAmountTrue, fee: feeTrue } = finalFunctions.outGivenInWithdraw(
        burnAmount,
        specificReserves,
        totalReserves,
        tick
      )
      expect(Number(withdrawAmount)).to.be.closeTo(withdrawAmountTrue, ONE_HUNDRED_MILLIONTH * withdrawAmountTrue)
      expect(fee).to.equal(feeTrue)
    })

    it("price=0.9, slope=1, increaseFee=0.01", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const allocation = utils.formatAllocationFromDecimal(0.1)
      const nextAllocation = utils.formatAllocationFromDecimal(0.2)
      const price = utils.formatPriceFromDecimal(0.9)
      const increaseFee = utils.formatFeeFromDecimal(0.01)
      const decreaseFee = utils.formatFeeFromDecimal(0)
      const priceSlope = utils.formatPriceSlopeFromDecimal(1)

      const tick = {
        allocation: allocation,
        nextAllocation: nextAllocation,
        price: price,
        increaseFee: increaseFee,
        decreaseFee: decreaseFee,
        priceSlope: priceSlope,
      }

      const [withdrawAmount, fee] = await poolMathWrapper.calcStepWithdrawal(
        burnAmount,
        totalReserves,
        specificReserves,
        tick
      )

      const { output: withdrawAmountTrue, fee: feeTrue } = finalFunctions.outGivenInWithdraw(
        burnAmount,
        specificReserves,
        totalReserves,
        tick
      )
      expect(Number(withdrawAmount)).to.be.closeTo(withdrawAmountTrue, ONE_HUNDRED_MILLIONTH * withdrawAmountTrue)
      expect(fee).to.equal(feeTrue)
    })
  })

  describe("calcStepBurn", function() {
    const totalReserves =    1000000000000000000n//1e^18
    const specificReserves = 120000000000000000n//0.12e^18
    const withdrawAmount =   10000000000000000n//0.01e^18
    it("price=1, slope=0, increaseFee=0", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const allocation = utils.formatAllocationFromDecimal(0.1)
      const nextAllocation = utils.formatAllocationFromDecimal(0.2)
      const price = utils.formatPriceFromDecimal(1)
      const increaseFee = utils.formatFeeFromDecimal(0)
      const decreaseFee = utils.formatFeeFromDecimal(0)
      const priceSlope = utils.formatPriceSlopeFromDecimal(0)

      const tick = {
        allocation: allocation,
        nextAllocation: nextAllocation,
        price: price,
        increaseFee: increaseFee,
        decreaseFee: decreaseFee,
        priceSlope: priceSlope,
      }

      const [burnAmount, fee] = await poolMathWrapper.calcStepBurn(
        withdrawAmount,
        totalReserves,
        specificReserves,
        tick
      )
      expect(burnAmount).to.equal(withdrawAmount);
      expect(fee).to.equal(0n)
    })

    it("price=1.1, slope=0, increaseFee=0", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const allocation = utils.formatAllocationFromDecimal(0.1)
      const nextAllocation = utils.formatAllocationFromDecimal(0.2)
      const price = utils.formatPriceFromDecimal(1.1)
      const increaseFee = utils.formatFeeFromDecimal(0)
      const decreaseFee = utils.formatFeeFromDecimal(0)
      const priceSlope = utils.formatPriceSlopeFromDecimal(0)

      const tick = {
        allocation: allocation,
        nextAllocation: nextAllocation,
        price: price,
        increaseFee: increaseFee,
        decreaseFee: decreaseFee,
        priceSlope: priceSlope,
      }

      const [burnAmount, fee] = await poolMathWrapper.calcStepBurn(
        withdrawAmount,
        totalReserves,
        specificReserves,
        tick
      )
      expect(burnAmount).to.equal((withdrawAmount * utils.scalePrice(price)) >> utils.SHIFT);
      expect(fee).to.equal(0n)
    })
    
    it("price=1, slope=1, increaseFee=0", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const allocation = utils.formatAllocationFromDecimal(0.1)
      const nextAllocation = utils.formatAllocationFromDecimal(0.2)
      const price = utils.formatPriceFromDecimal(1)
      const increaseFee = utils.formatFeeFromDecimal(0)
      const decreaseFee = utils.formatFeeFromDecimal(0)
      const priceSlope = utils.formatPriceSlopeFromDecimal(1)

      const tick = {
        allocation: allocation,
        nextAllocation: nextAllocation,
        price: price,
        increaseFee: increaseFee,
        decreaseFee: decreaseFee,
        priceSlope: priceSlope,
      }

      const [burnAmount, fee] = await poolMathWrapper.calcStepBurn(
        withdrawAmount,
        totalReserves,
        specificReserves,
        tick
      )

      const { input: burnAmountTrue, fee: feeTrue } = finalFunctions.inGivenOutWithdraw(
        withdrawAmount,
        specificReserves,
        totalReserves,
        tick
      )
      expect(Number(burnAmount)).to.be.closeTo(burnAmountTrue, ONE_HUNDRED_MILLIONTH * burnAmountTrue)
      expect(Number(fee)).to.equal(feeTrue)
    })

    it("price=1, slope=0, increaseFee=0.1", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const allocation = utils.formatAllocationFromDecimal(0.1)
      const nextAllocation = utils.formatAllocationFromDecimal(0.2)
      const price = utils.formatPriceFromDecimal(1)
      const increaseFee = utils.formatFeeFromDecimal(0.1)
      const decreaseFee = utils.formatFeeFromDecimal(0)
      const priceSlope = utils.formatPriceSlopeFromDecimal(0)

      const tick = {
        allocation: allocation,
        nextAllocation: nextAllocation,
        price: price,
        increaseFee: increaseFee,
        decreaseFee: decreaseFee,
        priceSlope: priceSlope,
      }

      const [burnAmount, fee] = await poolMathWrapper.calcStepBurn(
        withdrawAmount,
        totalReserves,
        specificReserves,
        tick
      )

      const { input: burnAmountTrue, fee: feeTrue } = finalFunctions.inGivenOutWithdraw(
        withdrawAmount,
        specificReserves,
        totalReserves,
        tick
      )
      expect(Number(burnAmount)).to.be.closeTo(burnAmountTrue, ONE_HUNDRED_MILLIONTH * burnAmountTrue)
      expect(fee).to.equal(feeTrue)
    })

    it("price=0.9, slope=1, increaseFee=0.01", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const allocation = utils.formatAllocationFromDecimal(0.1)
      const nextAllocation = utils.formatAllocationFromDecimal(0.2)
      const price = utils.formatPriceFromDecimal(0.9)
      const increaseFee = utils.formatFeeFromDecimal(0.01)
      const decreaseFee = utils.formatFeeFromDecimal(0)
      const priceSlope = utils.formatPriceSlopeFromDecimal(1)

      const tick = {
        allocation: allocation,
        nextAllocation: nextAllocation,
        price: price,
        increaseFee: increaseFee,
        decreaseFee: decreaseFee,
        priceSlope: priceSlope,
      }

      const [burnAmount, fee] = await poolMathWrapper.calcStepBurn(
        withdrawAmount,
        totalReserves,
        specificReserves,
        tick
      )

      const { input: burnAmountTrue, fee: feeTrue } = finalFunctions.inGivenOutWithdraw(
        withdrawAmount,
        specificReserves,
        totalReserves,
        tick
      )
      expect(Number(burnAmount)).to.be.closeTo(burnAmountTrue, ONE_HUNDRED_MILLIONTH * burnAmountTrue)
      expect(fee).to.equal(feeTrue)
    })
  })

  describe("computeMintGivenDeposit", function() {
    const decimals = 18
    const targetAllocation = 0.15
    const maxAllocation = 0.3
    const incompleteTicks = [
      {
        allocation: 0.01,
        price: 1.01,
        increaseFee: 0,
        decreaseFee: 0.01
      }, 
      {
        allocation: 0.1,
        price: 1.001,
        increaseFee: 0.001,
        decreaseFee: 0.001
      },
      {
        allocation: 0.2,
        price: 0.999,
        increaseFee: 0.01,
        decreaseFee: 0
      },
      {
        allocation: 0.3,
        price: 0.99,
        increaseFee: 0,//irrelevant in all situations
        decreaseFee: 0//irrelevant in all situations
      },
    ]
    const assetParams = utils.createAssetParams(
      decimals,
      targetAllocation,
      maxAllocation,
      incompleteTicks
    )

    it("basic swap with no tick crossing", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const totalReserves =    1000000000000000000n//1e^18
      const specificReserves = 100000000000000000n//0.1e^18
      const depositAmount =    10000000000000000n//0.01e^18

      const [mintAmount, fee] = await poolMathWrapper.computeMintGivenDeposit(
        assetParams,
        depositAmount,
        specificReserves,
        totalReserves
      )

      const [mintAmountStep0, fee0] = await poolMathWrapper.calcStepMint(
        depositAmount,
        totalReserves,
        specificReserves,
        assetParams.tickData[1]
      )

      const { output: mintAmountTrue, fee: feeTrue} = finalFunctions.outGivenInDeposit(
        depositAmount,
        specificReserves,
        totalReserves,
        assetParams.tickData[1]
      )

      //compare to library function
      expect(mintAmount).to.equal(mintAmountStep0)
      expect(fee).to.equal(fee0)

      //compare to javascript function
      expect(Number(mintAmount)).to.equal(mintAmountTrue)
      expect(Number(fee)).to.equal(feeTrue)
    })

    it("swap with tick crossing", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const totalReserves =         1000000000000000000n//1e^18
      const specificReserves =      100000000000000000n//0.1e^18

      //starting at 0.1 allocation, crossing 0.2 into 0.25
      const depositAmountStep0 =    125000000000000000n//0.125e^18
      const totalReservesStep1 = totalReserves + depositAmountStep0
      const specificReservesStep1 = specificReserves + depositAmountStep0
      //after depositing the above amount we cross into 0.2-0.3
      //now the deposit is arbitrary for testing purposes
      const depositAmountStep1 =    10000000000000000n//0.01e^18
      const depositAmount = depositAmountStep0 + depositAmountStep1

      const [mintAmount, fee] = await poolMathWrapper.computeMintGivenDeposit(
        assetParams,
        depositAmount,
        specificReserves,
        totalReserves
      )

      const [mintAmountStep0, fee0] = await poolMathWrapper.calcStepMint(
        depositAmountStep0,
        totalReserves,
        specificReserves,
        assetParams.tickData[1]
      )

      const [mintAmountStep1, fee1] = await poolMathWrapper.calcStepMint(
        depositAmountStep1,
        totalReservesStep1,
        specificReservesStep1,
        assetParams.tickData[2]
      )

      const { output: mintAmountStep0True, fee: feeStep0True} = finalFunctions.outGivenInDeposit(
        depositAmountStep0,
        specificReserves,
        totalReserves,
        assetParams.tickData[1]
      )

      const { output: mintAmountStep1True, fee: feeStep1True} = finalFunctions.outGivenInDeposit(
        depositAmountStep1,
        specificReservesStep1,
        totalReservesStep1,
        assetParams.tickData[2]
      )

      const stepsMintAmount = mintAmountStep0 + mintAmountStep1
      const stepsFee = fee0 + fee1
      const trueMintAmount = mintAmountStep0True + mintAmountStep1True
      const trueFee = feeStep0True + feeStep1True

      //compare to solidity functions
      expect(mintAmount).to.be.closeTo(stepsMintAmount, BigInt(Math.floor(Number(stepsMintAmount) * ONE_HUNDRED_MILLIONTH)))
      expect(fee).to.be.closeTo(stepsFee, BigInt(Math.floor(Number(stepsFee) * ONE_HUNDRED_MILLIONTH)))

      //compare to js functions
      expect(Number(mintAmount)).to.be.closeTo(trueMintAmount, trueMintAmount * ONE_HUNDRED_MILLIONTH)
      expect(Number(fee)).to.be.closeTo(trueFee, trueFee * ONE_HUNDRED_MILLIONTH)
    })

    it("shouldn't be able to mint above the max allocation, starting inside the max allocation", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const totalReserves =         1000000000000000000n//1e^18
      const specificReserves =      100000000000000000n//0.1e^18

      const maxDeposit = await poolMathWrapper.calcStepMaxDeposit(
        assetParams.maxAllocation,
        specificReserves,
        totalReserves
      )

      await expect(
        poolMathWrapper.computeMintGivenDeposit(
          assetParams,
          maxDeposit+1n,
          specificReserves,
          totalReserves
        )
      ).to.be.revertedWithPanic("0x32")
    })

    it("shouldn't be able to mint above the max allocation, starting outside the max allocation", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const totalReserves =         1000000000000000000n//1e^18
      const specificReserves =      300000000000000000n//0.1e^18
    
      await expect(
        poolMathWrapper.computeMintGivenDeposit(assetParams,
          1n,
          specificReserves,
          totalReserves
        )
      ).to.be.revertedWithPanic("0x11")
    })

    it("should be able to mint below the max allocation", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const totalReserves =         1000000000000000000n//1e^18
      const specificReserves =      100000000000000000n//0.1e^18

      const maxDeposit = await poolMathWrapper.calcStepMaxDeposit(
        assetParams.maxAllocation,
        specificReserves,
        totalReserves
      )

      await expect(
        poolMathWrapper.computeMintGivenDeposit(
          assetParams,
          maxDeposit,
          specificReserves,
          totalReserves
        )
      ).not.to.be.revertedWithPanic()
    })

    it("should be able to mint below the min allocation", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const totalReserves =         1000000000000000000n//1e^18
      const specificReserves =      0n

      const maxDeposit = await poolMathWrapper.calcStepMaxDeposit(
        assetParams.maxAllocation,
        specificReserves,
        totalReserves
      )

      await expect(
        poolMathWrapper.computeMintGivenDeposit(
          assetParams,
          maxDeposit,
          specificReserves,
          totalReserves
        )
      ).not.to.be.revertedWithoutReason()
    })
  })

  describe("computeDepositGivenMint", function() {
    const decimals = 18
    const targetAllocation = 0.15
    const maxAllocation = 0.3
    const incompleteTicks = [
      {
        allocation: 0.01,
        price: 1.01,
        increaseFee: 0,
        decreaseFee: 0.01
      }, 
      {
        allocation: 0.1,
        price: 1.001,
        increaseFee: 0.001,
        decreaseFee: 0.001
      },
      {
        allocation: 0.2,
        price: 0.999,
        increaseFee: 0.01,
        decreaseFee: 0
      },
      {
        allocation: 0.3,
        price: 0.99,
        increaseFee: 0,//irrelevant in all situations
        decreaseFee: 0//irrelevant in all situations
      },
    ]
    const assetParams = utils.createAssetParams(
      decimals,
      targetAllocation,
      maxAllocation,
      incompleteTicks
    )

    it("basic swap with no tick crossing", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const totalReserves =    1000000000000000000n//1e^18
      const specificReserves = 100000000000000000n//0.1e^18
      const mintAmount =       10000000000000000n//0.01e^18

      const [depositAmount, fee] = await poolMathWrapper.computeDepositGivenMint(
        assetParams,
        mintAmount,
        specificReserves,
        totalReserves
      )

      const [depositAmountStep0, fee0] = await poolMathWrapper.calcStepDeposit(
        mintAmount,
        totalReserves,
        specificReserves,
        assetParams.tickData[1]
      )

      const { input: depositAmountTrue, fee: feeTrue} = finalFunctions.inGivenOutDeposit(
        mintAmount,
        specificReserves,
        totalReserves,
        assetParams.tickData[1]
      )

      //compare to library function
      expect(depositAmount).to.equal(depositAmountStep0)
      expect(fee).to.equal(fee0)

      //compare to javascript function
      expect(Number(depositAmount)).to.be.closeTo(depositAmountTrue, depositAmountTrue * ONE_HUNDRED_MILLIONTH)
      expect(Number(fee)).to.equal(feeTrue)
    })

    it("swap with tick crossing", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const totalReserves =         1000000000000000000n//1e^18
      const specificReserves =      100000000000000000n//0.1e^18

      const baseDepositAmountStep0= 125000000000000000n//0.125e^18
      const [mintAmountStep0] = await poolMathWrapper.calcStepMint(
        baseDepositAmountStep0,
        totalReserves,
        specificReserves,
        assetParams.tickData[1]
      )

      //starting at 0.1 allocation, crossing 0.2 into 0.25
      const totalReservesStep1 = totalReserves + baseDepositAmountStep0
      const specificReservesStep1 = specificReserves + baseDepositAmountStep0

      const baseDepositAmountStep1= 10000000000000000n
      const [mintAmountStep1] = await poolMathWrapper.calcStepMint(
        baseDepositAmountStep1,
        totalReservesStep1,
        specificReservesStep1,
        assetParams.tickData[2]
      )

      const mintAmount = mintAmountStep0 + mintAmountStep1

      const [depositAmount, fee] = await poolMathWrapper.computeDepositGivenMint(
        assetParams,
        mintAmount,
        specificReserves,
        totalReserves
      )


      const [depositAmountStep0, fee0] = await poolMathWrapper.calcStepDeposit(
        mintAmountStep0,
        totalReserves,
        specificReserves,
        assetParams.tickData[1]
      )

      const [depositAmountStep1, fee1] = await poolMathWrapper.calcStepDeposit(
        mintAmountStep1,
        totalReservesStep1,
        specificReservesStep1,
        assetParams.tickData[2]
      )

      const { input: depositAmountStep0True, fee: feeStep0True} = finalFunctions.inGivenOutDeposit(
        mintAmountStep0,
        specificReserves,
        totalReserves,
        assetParams.tickData[1]
      )

      const { input: depositAmountStep1True, fee: feeStep1True} = finalFunctions.inGivenOutDeposit(
        mintAmountStep1,
        specificReservesStep1,
        totalReservesStep1,
        assetParams.tickData[2]
      )

      const stepsDepositAmount = depositAmountStep0 + depositAmountStep1
      const stepsFee = fee0 + fee1
      const trueDepositAmount = depositAmountStep0True + depositAmountStep1True
      const trueFee = feeStep0True + feeStep1True

      //console.log("depositAmount", depositAmount, stepsDepositAmount)

      //compare to solidity functions
      expect(depositAmount).to.be.closeTo(stepsDepositAmount, BigInt(Math.floor(Number(stepsDepositAmount) * ONE_HUNDRED_MILLIONTH)))
      expect(fee).to.be.closeTo(stepsFee, BigInt(Math.floor(Number(stepsFee) * ONE_HUNDRED_MILLIONTH)))

      //compare to js functions
      expect(Number(depositAmount)).to.be.closeTo(trueDepositAmount, trueDepositAmount * Number(utils.SCALE) * ONE_HUNDRED_MILLIONTH)
      expect(Number(fee)).to.be.closeTo(trueFee, trueFee * ONE_HUNDRED_MILLIONTH)
    })

    it("shouldn't be able to mint above the max allocation, starting inside the max allocation", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const totalReserves =         1000000000000000000n//1e^18
      const specificReserves =      250000000000000000n//0.1e^18

      const maxDeposit = await poolMathWrapper.calcStepMaxDeposit(
        assetParams.maxAllocation,
        specificReserves,
        totalReserves
      )
      const [maxMint, fee] = await poolMathWrapper.calcStepMint(
        maxDeposit,
        totalReserves,
        specificReserves,
        assetParams.tickData[assetParams.tickData.length - 1]
      )

      await expect(
        poolMathWrapper.computeDepositGivenMint(
          assetParams,
          maxMint+BigInt(Math.floor(Number(maxMint)*ONE_HUNDRED_MILLIONTH)),//slighlty above because there is a margin of error in the underlying function
          specificReserves,
          totalReserves
        )
      ).to.be.revertedWithPanic("0x32")
    })

    it("shouldn't be able to mint above the max allocation, starting outside the max allocation", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const totalReserves =         1000000000000000000n//1e^18
      const specificReserves =      300000000000000000n//0.1e^18
    
      await expect(
        poolMathWrapper.computeDepositGivenMint(
          assetParams,
          1n,
          specificReserves,
          totalReserves
        )
      ).to.be.revertedWithPanic("0x11")
    })

    it("should be able to mint below the min allocation", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const totalReserves =         1000000000000000000n//1e^18
      const specificReserves =      0n//0.1e^18

      const maxDeposit = await poolMathWrapper.calcStepMaxDeposit(
        assetParams.maxAllocation,
        specificReserves,
        totalReserves
      )

      await expect(
        poolMathWrapper.computeMintGivenDeposit(
          assetParams,
          maxDeposit,
          specificReserves,
          totalReserves
        )
      ).not.to.be.revertedWithPanic()
    })
  })

  describe("computeWithdrawalGivenBurn", function() {
    const decimals = 18
    const targetAllocation = 0.15
    const maxAllocation = 0.3
    const incompleteTicks = [
      {
        allocation: 0.01,
        price: 1.01,
        increaseFee: 0,
        decreaseFee: 0.01
      }, 
      {
        allocation: 0.1,
        price: 1.001,
        increaseFee: 0.001,
        decreaseFee: 0.001
      },
      {
        allocation: 0.2,
        price: 0.999,
        increaseFee: 0.01,
        decreaseFee: 0
      },
      {
        allocation: 0.3,
        price: 0.99,
        increaseFee: 0,//irrelevant in all situations
        decreaseFee: 0//irrelevant in all situations
      },
    ]
    const assetParams = utils.createAssetParams(
      decimals,
      targetAllocation,
      maxAllocation,
      incompleteTicks
    )

    it("basic swap with no tick crossing", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const totalReserves =    1000000000000000000n//1e^18
      const specificReserves = 190000000000000000n//0.1e^18
      const burnAmount =       10000000000000000n//0.01e^18

      const [withdrawAmount, fee] = await poolMathWrapper.computeWithdrawalGivenBurn(
        assetParams,
        burnAmount,
        specificReserves,
        totalReserves
      )

      const [withdrawAmountStep0, fee0] = await poolMathWrapper.calcStepWithdrawal(
        burnAmount,
        totalReserves,
        specificReserves,
        assetParams.tickData[1]
      )

      const { output: withdrawAmountTrue, fee: feeTrue} = finalFunctions.outGivenInWithdraw(
        burnAmount,
        specificReserves,
        totalReserves,
        assetParams.tickData[1]
      )

      //compare to library function
      expect(withdrawAmount).to.equal(withdrawAmountStep0)
      expect(fee).to.equal(fee0)

      //compare to javascript function
      expect(Number(withdrawAmount)).to.be.closeTo(withdrawAmountTrue, withdrawAmountTrue * ONE_HUNDRED_MILLIONTH)
      expect(Number(fee)).to.equal(feeTrue)
    })

    it("swap with tick crossing", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const diff0 =            150000000000000000n//0.15e^18
      const totalReserves =    1000000000000000000n + diff0//1e^18 + diff
      const specificReserves = 100000000000000000n + diff0//0.1e^18 + diff

      const _withdrawalAmount0 = await poolMathWrapper.calcStepMaxWithdrawal(
        assetParams.tickData[2].allocation,
        specificReserves,
        totalReserves
      )

      const [burnAmount0] = await poolMathWrapper.calcStepBurn(
        _withdrawalAmount0,
        totalReserves,
        specificReserves,
        assetParams.tickData[2]
      )
      const totalReservesStep1 = totalReserves - _withdrawalAmount0
      const specificReservesStep1 = specificReserves - _withdrawalAmount0

      const _withdrawalAmount1 = await poolMathWrapper.calcStepMaxWithdrawal(
        assetParams.tickData[1].allocation,
        specificReservesStep1,
        totalReservesStep1
      )

      const [burnAmount1] = await poolMathWrapper.calcStepBurn(
        _withdrawalAmount1,
        totalReservesStep1,
        specificReservesStep1,
        assetParams.tickData[1]
      )

      const [withdrawalAmount0, fee0] = await poolMathWrapper.calcStepWithdrawal(
        burnAmount0,
        totalReserves,
        specificReserves,
        assetParams.tickData[2]
      ) 

      const [withdrawalAmount1, fee1] = await poolMathWrapper.calcStepWithdrawal(
        burnAmount1,
        totalReservesStep1,
        specificReservesStep1,
        assetParams.tickData[1]
      )

      const { output: withdrawalAmount0True, fee: fee0True } = finalFunctions.outGivenInWithdraw(
        burnAmount0,
        specificReserves,
        totalReserves,
        assetParams.tickData[2]
      )

      const { output: withdrawalAmount1True, fee: fee1True } = finalFunctions.outGivenInWithdraw(
        burnAmount1,
        specificReservesStep1,
        totalReservesStep1,
        assetParams.tickData[1]
      )
      
      const stepsWithdrawalAmount = withdrawalAmount0 + withdrawalAmount1
      const stepsFee = fee0 + fee1
      const trueWithdrawalAmount = withdrawalAmount0True + withdrawalAmount1True
      const trueFee = fee0True + fee1True

      const [withdrawalAmount, fee] = await poolMathWrapper.computeWithdrawalGivenBurn(
        assetParams,
        burnAmount0 + burnAmount1,
        specificReserves,
        totalReserves
      )
      
      //compare to solidity functions
      expect(withdrawalAmount).to.be.closeTo(stepsWithdrawalAmount, BigInt(Math.floor(Number(stepsWithdrawalAmount) * ONE_HUNDRED_MILLIONTH)))
      expect(fee).to.be.closeTo(stepsFee, BigInt(Math.floor(Number(stepsFee) * ONE_HUNDRED_MILLIONTH)))

      //compare to js functions
      expect(Number(withdrawalAmount)).to.be.closeTo(trueWithdrawalAmount, trueWithdrawalAmount * Number(utils.SCALE) * ONE_HUNDRED_MILLIONTH)
      expect(Number(fee)).to.be.closeTo(trueFee, trueFee * ONE_HUNDRED_MILLIONTH)
    })

    it("shouldn't be able to burn below the min allocation, starting inside the allocation", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const totalReserves =         1000000000000000000n//1e^18
      const specificReserves =      90000000000000000n//0.09e^18

      const maxWithdrawal = await poolMathWrapper.calcStepMaxWithdrawal(
        assetParams.minAllocation,
        specificReserves,
        totalReserves
      )

      //console.log(utils.fixedToDecimal(utils.scaleAllocation(assetParams.minAllocation)), Number(specificReserves - maxWithdrawal) / Number(totalReserves - maxWithdrawal))

      const [burnAmount] = await poolMathWrapper.calcStepBurn(
        maxWithdrawal,
        totalReserves,
        specificReserves,
        assetParams.tickData[0]
      )

      await expect(
        poolMathWrapper.computeWithdrawalGivenBurn(
          assetParams,
          burnAmount + BigInt(Math.floor(Number(burnAmount) * ONE_HUNDRED_MILLIONTH)),
          specificReserves,
          totalReserves
        )
      ).to.be.revertedWithPanic("0x11")//overflow decrementing the tick index from 0 to -1
    })

    it("shouldn't be able to burn below the min allocation, starting outside the allocation", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const totalReserves =         1000000000000000000n//1e^18
      const specificReserves =      9000000000000000n//0.009e^18

      await expect(
        poolMathWrapper.computeWithdrawalGivenBurn(
          assetParams,
          1n,
          specificReserves,
          totalReserves
        )
      ).to.be.revertedWithPanic("0x11")//overflow in calcStepMaxWithdrawal
    })

    it("should be able to burn above the max allocation", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const totalReserves =         1000000000000000000n//1e^18
      const specificReserves =      1000000000000000000n//1e^18

      await expect(
        poolMathWrapper.computeWithdrawalGivenBurn(
          assetParams,
          1n,
          specificReserves,
          totalReserves
        )
      ).not.to.be.revertedWithoutReason()
    })
  })

  describe("computeBurnGivenWithdrawal", function() {
    const decimals = 18
    const targetAllocation = 0.15
    const maxAllocation = 0.3
    const incompleteTicks = [
      {
        allocation: 0.01,
        price: 1.01,
        increaseFee: 0,
        decreaseFee: 0.01
      }, 
      {
        allocation: 0.1,
        price: 1.001,
        increaseFee: 0.001,
        decreaseFee: 0.001
      },
      {
        allocation: 0.2,
        price: 0.999,
        increaseFee: 0.01,
        decreaseFee: 0
      },
      {
        allocation: 0.3,
        price: 0.99,
        increaseFee: 0,//irrelevant in all situations
        decreaseFee: 0//irrelevant in all situations
      },
    ]
    const assetParams = utils.createAssetParams(
      decimals,
      targetAllocation,
      maxAllocation,
      incompleteTicks
    )

    it("basic swap with no tick crossing", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const totalReserves =    1000000000000000000n//1e^18
      const specificReserves = 160000000000000000n//0.19e^18
      const withdrawAmount =   10000000000000000n//0.01e^18

      const [burnAmount, fee] = await poolMathWrapper.computeBurnGivenWithdrawal(
        assetParams,
        withdrawAmount,
        specificReserves,
        totalReserves
      )

      const [burnAmountStep, feeStep] = await poolMathWrapper.calcStepBurn(
        withdrawAmount,
        totalReserves,
        specificReserves,
        assetParams.tickData[1]
      )

      const { input: burnAmountTrue, fee: feeTrue } = finalFunctions.inGivenOutWithdraw(
        withdrawAmount,
        specificReserves,
        totalReserves,
        assetParams.tickData[1]
      )

      //compare to library function
      expect(burnAmount).to.equal(burnAmountStep)
      expect(fee).to.equal(feeStep)

      //compare to javascript function
      expect(Number(burnAmount)).to.be.closeTo(burnAmountTrue, burnAmountTrue * ONE_HUNDRED_MILLIONTH)
      expect(Number(fee)).to.equal(feeTrue)
    })

    it("swap with tick crossing", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const diff0 =            150000000000000000n//0.15e^18
      const totalReserves =    1000000000000000000n + diff0//1e^18 + diff
      const specificReserves = 100000000000000000n + diff0//0.1e^18 + diff

      const withdrawAmount0 = await poolMathWrapper.calcStepMaxWithdrawal(
        assetParams.tickData[2].allocation,
        specificReserves,
        totalReserves
      )

      const [burnAmount0, fee0] = await poolMathWrapper.calcStepBurn(
        withdrawAmount0,
        totalReserves,
        specificReserves,
        assetParams.tickData[2]
      )
      const totalReservesStep1 = totalReserves - withdrawAmount0
      const specificReservesStep1 = specificReserves - withdrawAmount0
      
      const withdrawAmount1 = await poolMathWrapper.calcStepMaxWithdrawal(
        assetParams.tickData[1].allocation,
        specificReservesStep1,
        totalReservesStep1
      )

      const [burnAmount1, fee1] = await poolMathWrapper.calcStepBurn(
        withdrawAmount1,
        totalReservesStep1,
        specificReservesStep1,
        assetParams.tickData[1]
      )

      const { input: burnAmount0True, fee: fee0True } = finalFunctions.inGivenOutWithdraw(
        withdrawAmount0,
        specificReserves,
        totalReserves,
        assetParams.tickData[2]
      )

      const { input: burnAmount1True, fee: fee1True } = finalFunctions.inGivenOutWithdraw(
        withdrawAmount1,
        specificReservesStep1,
        totalReservesStep1,
        assetParams.tickData[1]
      )

      const [burnAmount, fee] = await poolMathWrapper.computeBurnGivenWithdrawal(
        assetParams,
        withdrawAmount0 + withdrawAmount1,
        specificReserves,
        totalReserves
      )

      //compare to solidity functions
      expect(burnAmount).to.equal(burnAmount0 + burnAmount1)
      expect(fee).to.equal(fee0 + fee1)

      const burnAmountTrue = burnAmount0True + burnAmount1True
      const feeTrue = fee0True + fee1True

      //compare to js functions
      expect(Number(burnAmount)).to.be.closeTo(burnAmountTrue, burnAmountTrue * ONE_HUNDRED_MILLIONTH_STRING)
      expect(Number(fee)).to.be.closeTo(feeTrue, feeTrue * ONE_HUNDRED_MILLIONTH_STRING)
    })

    it("shouldn't be able to burn below min allocation starting inside allowed allocation", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const totalReserves =    1000000000000000000n//1e^18 + diff
      const specificReserves = 100000000000000000n//0.1e^18

      const maxWithdrawal = await poolMathWrapper.calcStepMaxWithdrawal(
        assetParams.minAllocation,
        specificReserves,
        totalReserves
      )

      //console.log("maxWithdrawal", maxWithdrawal)

      await expect(
        poolMathWrapper.computeBurnGivenWithdrawal(
          assetParams,
          maxWithdrawal+2n,
          specificReserves,
          totalReserves
        )
      ).to.be.revertedWithPanic("0x11")//overflow when decrementing the tick index past 0
    })

    it("shouln't be able to burn below min allocation starting outside allowed allocation", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const totalReserves =    1000000000000000000n//1e^18
      const specificReserves = 9000000000000000n//0.009e^18
     
      await expect(
        poolMathWrapper.computeBurnGivenWithdrawal(
          assetParams,
          1n,
          specificReserves,
          totalReserves
        )
      ).to.be.revertedWithPanic("0x11")//overflow calculating the max withdrawal
    })

    it("should be able to burn above the max allocation", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const totalReserves =    1000000000000000000n//1e^18
      const specificReserves = 1000000000000000000n//1e^18

      await expect(
        poolMathWrapper.computeBurnGivenWithdrawal(
          assetParams,
          1n,
          specificReserves,
          totalReserves
        )
      ).not.to.be.revertedWithoutReason()
    })
  })

  describe("computeSwapUnderlyingGivenIn", function() {
    const decimals = 18
    const targetAllocation = 0.15
    const maxAllocation = 0.3
    const incompleteTicks = [
      {
        allocation: 0.01,
        price: 1.01,
        increaseFee: 0,
        decreaseFee: 0.01
      }, 
      {
        allocation: 0.1,
        price: 1.001,
        increaseFee: 0.001,
        decreaseFee: 0.001
      },
      {
        allocation: 0.2,
        price: 0.999,
        increaseFee: 0.01,
        decreaseFee: 0
      },
      {
        allocation: 0.3,
        price: 0.99,
        increaseFee: 0,//irrelevant in all situations
        decreaseFee: 0//irrelevant in all situations
      },
    ]
    const assetParams0 = utils.createAssetParams(
      decimals,
      targetAllocation,
      maxAllocation,
      incompleteTicks
    )

    const assetParams1 = utils.createAssetParams(
      decimals,
      targetAllocation,
      maxAllocation,
      incompleteTicks
    )

    it("should return an amount equal to a deposit and then a withdrawal", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const totalReserves =     1000000000000000000n//1e^18
      const specificReserves0 = 100000000000000000n//0.1e^18
      const specificReserves1 = 100000000000000000n//0.1e^18
      const inputAmount =       80000000000000000n//0.08e^18

      const [mintAmount, fee0] = await poolMathWrapper.computeMintGivenDeposit(
        assetParams0,
        inputAmount,
        specificReserves0,
        totalReserves
      )

      const [withdrawAmount, fee1] = await poolMathWrapper.computeWithdrawalGivenBurn(
        assetParams1,
        mintAmount,
        specificReserves1,
        totalReserves + inputAmount
      )

      const [outputAmount, fee] = await poolMathWrapper.computeSwapUnderlyingGivenIn(
        assetParams0,
        assetParams1,
        inputAmount,
        specificReserves0,
        specificReserves1,
        totalReserves
      )

      expect(outputAmount).to.equal(withdrawAmount)
      expect(fee).to.equal(fee0 + fee1)
    })
  })

  describe("computeSwapUnderlyingGivenOut", function() {
    const decimals = 18
    const targetAllocation = 0.15
    const maxAllocation = 0.3
    const incompleteTicks = [
      {
        allocation: 0.01,
        price: 1.01,
        increaseFee: 0,
        decreaseFee: 0.01
      }, 
      {
        allocation: 0.1,
        price: 1.001,
        increaseFee: 0.001,
        decreaseFee: 0.001
      },
      {
        allocation: 0.2,
        price: 0.999,
        increaseFee: 0.01,
        decreaseFee: 0
      },
      {
        allocation: 0.3,
        price: 0.99,
        increaseFee: 0,//irrelevant in all situations
        decreaseFee: 0//irrelevant in all situations
      },
    ]
    const assetParams0 = utils.createAssetParams(
      decimals,
      targetAllocation,
      maxAllocation,
      incompleteTicks
    )

    const assetParams1 = utils.createAssetParams(
      decimals,
      targetAllocation,
      maxAllocation,
      incompleteTicks
    )

    it("should return an amount equal to a deposit and then a withdrawal", async function() {
      const { poolMathWrapper } = await loadFixture(deployAll);
      const totalReserves =     1200000000000000000n//1e^18
      const specificReserves0 = 200000000000000000n//0.2e^18
                                88888889061356032
      const specificReserves1 = 200000000000000000n//0.2e^18
      const outputAmount =      100000000000000000n//0.15e^18

      const [burnAmount, fee0] = await poolMathWrapper.computeBurnGivenWithdrawal(
        assetParams0,
        outputAmount,
        specificReserves0,
        totalReserves
      )

      const [depositAmount, fee1] = await poolMathWrapper.computeDepositGivenMint(
        assetParams1,
        burnAmount,
        specificReserves1,
        totalReserves - outputAmount
      )

      const [inputAmount, fee] = await poolMathWrapper.computeSwapUnderlyingGivenOut(
        assetParams0,
        assetParams1,
        outputAmount,
        specificReserves0,
        specificReserves1,
        totalReserves
      )

      expect(inputAmount).to.equal(depositAmount)
      expect(fee).to.equal(fee0 + fee1)
    })
  })
})