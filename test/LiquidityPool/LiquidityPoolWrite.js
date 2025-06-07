const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const utils = require("../testModules/utils.js");
const deployAll = require("./deployAll.js");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("LiquidityPool - Mint/Burn Functions", function () {
  describe("mint", function () {
    it("mints liquidity tokens and updates reserves as expected", async function () {
      const { poolMathWrapper, liquidityPool, indexToken, admin, mintable0, mintable1, mintable2, assetParams0, assetParams1, assetParams2 } = await loadFixture(deployAll);
      const mintAmount = utils.scale10Pow18(3000n);
      const prevBal0 = await mintable0.balanceOf(admin.address);
      const prevBal1 = await mintable1.balanceOf(admin.address);
      const prevBal2 = await mintable2.balanceOf(admin.address);
      const prevLiquidityBal = await indexToken.balanceOf(admin.address);
      const compoundingFeeRate = await poolMathWrapper.calcCompoundingFeeRate(await liquidityPool.getMintFeeQ128())
      const mintAmountPlusFee = mintAmount + ((mintAmount * compoundingFeeRate) >> 128n)
      await expect(
        liquidityPool.connect(admin).mint(mintAmount, admin.address)
      ).to.emit(liquidityPool, "Mint");

      const balance0 = await mintable0.balanceOf(admin.address);
      const balance1 = await mintable1.balanceOf(admin.address);
      const balance2 = await mintable2.balanceOf(admin.address);
      const liquidityBal = await indexToken.balanceOf(admin.address);

      // Check that liquidity tokens were minted
      const expectedReductionScaled0 = (utils.scaleAllocation(assetParams0.targetAllocation) * mintAmountPlusFee) >> utils.SHIFT
      const expectedReductionScaled1 = (utils.scaleAllocation(assetParams1.targetAllocation) * mintAmountPlusFee) >> utils.SHIFT
      const expectedReductionScaled2 = (utils.scaleAllocation(assetParams2.targetAllocation) * mintAmountPlusFee) >> utils.SHIFT

      const expectedReduction0 = utils.scaleDecimals(expectedReductionScaled0, 18n, assetParams0.decimals) + 1n
      const expectedReduction1 = utils.scaleDecimals(expectedReductionScaled1, 18n, assetParams1.decimals) + 1n
      const expectedReduction2 = utils.scaleDecimals(expectedReductionScaled2, 18n, assetParams2.decimals) + 1n

      const actualReduction0 = prevBal0 - balance0
      const actualReduction1 = prevBal1 - balance1
      const actualReduction2 = prevBal2 - balance2

      expect(liquidityBal - prevLiquidityBal).to.equal(mintAmount);
      // Check that reserves were deducted from admin
      expect(actualReduction0).to.equal(expectedReduction0)
      expect(actualReduction1).to.equal(expectedReduction1)
      expect(actualReduction2).to.equal(expectedReduction2)
      // Check that pool reserves increased
      const scaledReserves0 = await liquidityPool.getSpecificReservesScaled(mintable0.target);
      const scaledReserves1 = await liquidityPool.getSpecificReservesScaled(mintable1.target);
      const scaledReserves2 = await liquidityPool.getSpecificReservesScaled(mintable2.target);
      expect(scaledReserves0).to.be.closeTo(expectedReductionScaled0, expectedReductionScaled0 / 1_000_000_000n);
      expect(scaledReserves1).to.be.closeTo(expectedReductionScaled1, expectedReductionScaled1 / 1_000_000_000n);
      expect(scaledReserves2).to.be.closeTo(expectedReductionScaled2, expectedReductionScaled2 / 1_000_000_000n);
      
      //compare balances of contract to scaled reserves
      const contractBalance0 = await mintable0.balanceOf(liquidityPool.target);
      const contractBalance1 = await mintable1.balanceOf(liquidityPool.target);
      const contractBalance2 = await mintable2.balanceOf(liquidityPool.target);
      expect(contractBalance0).to.equal(utils.scaleDecimals(scaledReserves0, 18n, assetParams0.decimals))
      expect(contractBalance1).to.be.closeTo(utils.scaleDecimals(scaledReserves1, 18n, assetParams1.decimals), 1n)//rounding diff because this token has 20 decimal places. in reality this will probably not even matter in the insane case that we even have a token with 20 decimals
      expect(contractBalance2).to.equal(utils.scaleDecimals(scaledReserves2, 18n, assetParams2.decimals))

    });

    it("reverts if minting is disabled", async function () {
      const { liquidityPool, admin } = await loadFixture(deployAll);
      await liquidityPool.connect(admin).setIsMintEnabled(false);
      await expect(
        liquidityPool.connect(admin).mint(utils.scale10Pow18(1000n), admin.address)
      ).to.be.revertedWith("minting disabled");
    });

    it("succeeds when minting exactly up to the maxReserves limit (cooldown active)", async function () {
      const { liquidityPool, admin } = await loadFixture(deployAll);
      // Set a low maxReserves limit
      const lowLimit = utils.scale10Pow18(1000000n);
      await liquidityPool.connect(admin).setMaxReserves(lowLimit);
      //set fee to zero so we don't have to do a complex calculation
      await liquidityPool.connect(admin).setMintFeeQ128(0n);
      // Mint below the limit
      await expect(
        liquidityPool.connect(admin).mint(lowLimit - utils.scale10Pow18(1n), admin.address)
      ).to.not.be.reverted;
    });

    it("reverts when minting above the maxReserves limit (cooldown active)", async function () {
      const { liquidityPool, admin } = await loadFixture(deployAll);
      // Set a low maxReserves limit
      const lowLimit = utils.scale10Pow18(1000000n);
      await liquidityPool.connect(admin).setMaxReserves(lowLimit);
      //set fee to zero so we don't have to do a complex calculation
      await liquidityPool.connect(admin).setMintFeeQ128(0n);
      // Mint below the limit
      await expect(
        liquidityPool.connect(admin).mint(lowLimit+utils.scale10Pow18(1n), admin.address)
      ).to.be.revertedWith("max reserves limit");
    });

    it("succeeds when minting exactly up to the NEXT maxReserves limit (cooldown inactive)", async function () {
      const { liquidityPool, admin } = await loadFixture(deployAll);
      // Set a low maxReserves limit
      const lowLimit = utils.scale10Pow18(1000000n);
      await liquidityPool.connect(admin).setMaxReserves(lowLimit);
      //set fee to zero so we don't have to do a complex calculation
      await liquidityPool.connect(admin).setMintFeeQ128(0n);
      // fast forward to cooldown period end
      await time.increase(3600 * 24 + 1); // fast forward 1 day
      // Mint above the limit
      await expect(
        liquidityPool.connect(admin).mint(lowLimit+utils.scale10Pow18(1n), admin.address)
      ).not.to.be.revertedWith("max reserves limit");
      // get the new limit
      const nextMaxReserves = await liquidityPool.getMaxReserves();
      //reload the fixture to its initail state
      const resetVals = await loadFixture(deployAll);
      //set fee to zero so we don't have to do a complex calculation
      await resetVals.liquidityPool.connect(resetVals.admin).setMintFeeQ128(0n);
      //set the low limit again
      await resetVals.liquidityPool.connect(resetVals.admin).setMaxReserves(lowLimit);
      await time.increase(3600 * 24 + 1); // fast forward 1 day
      // mint above the next max reserves limit
      await expect(
        resetVals.liquidityPool.connect(resetVals.admin).mint(nextMaxReserves - utils.scale10Pow18(1n), resetVals.admin.address)
      ).not.to.be.revertedWith("max reserves limit");
    });

    it("reverts when minting above the NEXT maxReserves limit (cooldown inactive)", async function () {
      const { liquidityPool, admin } = await loadFixture(deployAll);
      // Set a low maxReserves limit
      const lowLimit = utils.scale10Pow18(1000000n);
      await liquidityPool.connect(admin).setMaxReserves(lowLimit);
      //set fee to zero so we don't have to do a complex calculation
      await liquidityPool.connect(admin).setMintFeeQ128(0n);
      // fast forward to cooldown period end
      await time.increase(3600 * 24 + 1); // fast forward 1 day
      // Mint above the limit
      await expect(
        liquidityPool.connect(admin).mint(lowLimit + utils.scale10Pow18(1n), admin.address)
      ).not.to.be.revertedWith("max reserves limit");
      // get the new limit
      const nextMaxReserves = await liquidityPool.getMaxReserves();
      //reload the fixture to its initail state
      const resetVals = await loadFixture(deployAll);
      //set fee to zero so we don't have to do a complex calculation
      await resetVals.liquidityPool.connect(resetVals.admin).setMintFeeQ128(0n);
      //set the low limit again
      await resetVals.liquidityPool.connect(resetVals.admin).setMaxReserves(lowLimit);
      await time.increase(3600 * 24 + 1); // fast forward 1 day
      // mint above the next max reserves limit
      await expect(
        resetVals.liquidityPool.connect(resetVals.admin).mint(nextMaxReserves + utils.scale10Pow18(1n), resetVals.admin.address)
      ).to.be.revertedWith("max reserves limit");
    });
  });

  describe("burn", function () {
    it("burns liquidity tokens and returns assets as expected", async function () {
      const { liquidityPool, indexToken, admin, mintable0, mintable1, mintable2 } = await loadFixture(deployAll);
      const mintAmount = utils.scale10Pow18(1000n);
      await liquidityPool.connect(admin).mint(mintAmount, admin.address);
      const prevBal0 = await mintable0.balanceOf(admin.address);
      const prevBal1 = await mintable1.balanceOf(admin.address);
      const prevBal2 = await mintable2.balanceOf(admin.address);
      const prevLiquidityBal = await indexToken.balanceOf(admin.address);

      await indexToken.connect(admin).approve(liquidityPool.target, mintAmount);
      await expect(
        liquidityPool.connect(admin).burn(mintAmount)
      ).to.emit(liquidityPool, "Burn");

      const balance0 = await mintable0.balanceOf(admin.address);
      const balance1 = await mintable1.balanceOf(admin.address);
      const balance2 = await mintable2.balanceOf(admin.address);
      const liquidityBal = await indexToken.balanceOf(admin.address);

      // Check that liquidity tokens were burned
      expect(prevLiquidityBal - liquidityBal).to.equal(mintAmount);
      // Check that assets were returned to admin
      expect(balance0).to.be.above(prevBal0);
      expect(balance1).to.be.above(prevBal1);
      expect(balance2).to.be.above(prevBal2);
    });

    it("reverts if user tries to burn more than their balance", async function () {
      const { liquidityPool, indexToken, admin } = await loadFixture(deployAll);
      const mintAmount = utils.scale10Pow18(1000n);
      await liquidityPool.connect(admin).mint(mintAmount, admin.address);
      await indexToken.connect(admin).approve(liquidityPool.target, mintAmount + 1n);
      await expect(
        liquidityPool.connect(admin).burn(mintAmount + 1n)
      ).to.be.reverted;
    });
  });

  describe("swapTowradsTarget", function() {
    describe("swap token equal to standard decimal scale", function() {
      describe("Withdraw", function() {

      })

      describe("Deposit", function() {
        
      })
    })
    describe("swap token below standard decimal scale", function() {
      describe("Withdraw", function() {
        it("should not allow swapping if the pool is equalized", async function() {
          const { liquidityPool, mintable0 } = await loadFixture(deployAll)
          await expect(
            liquidityPool.swapTowardsTarget(
              mintable0.target,
              -1n
            )
          ).to.be.revertedWith("withdrawal exceeds target allocation")
          await expect(
            liquidityPool.swapTowardsTarget(
              mintable0.target,
              1n
            )
          ).to.be.revertedWith("deposit exceeds target allocation")
        })

        it("should not allow swapping that increases discrepency", async function() {
          const { liquidityPool, mintable2, newTargetParams0, admin } = await loadFixture(deployAll)
          await liquidityPool.mint(utils.scale10Pow18(1_000_000n), admin.address)
          await liquidityPool.setTargetAssetParams(newTargetParams0)
          //mintable2 is now targetted at 0
          await expect(
            liquidityPool.swapTowardsTarget(
              mintable2.target,
              -1n
            )
          ).not.to.be.reverted
          await expect(
            liquidityPool.swapTowardsTarget(
              mintable2.target,
              1n
            )
          ).to.be.revertedWith("deposit exceeds target allocation")
        })

        it("should not allow swapping that passes the target allocation", async function() {
          const { liquidityPool, mintable2, newTargetParams0, admin } = await loadFixture(deployAll)
          await liquidityPool.mint(utils.scale10Pow18(1_000_000n), admin.address)
          await liquidityPool.setTargetAssetParams(newTargetParams0)
          //mintable2 is now targetted at 0
          const maxWithdrawal = await liquidityPool.getSpecificReserves(mintable2.target)
          await expect(
            liquidityPool.swapTowardsTarget(
              mintable2.target,
              (maxWithdrawal * -1n) - 1n
            )
          ).to.be.revertedWith("withdrawal exceeds target allocation")
        })

        it("should swap exactly to the target", async function() {
          const { liquidityPool, mintable2, newTargetParams0, admin } = await loadFixture(deployAll)
          await liquidityPool.mint(utils.scale10Pow18(1_000_000n), admin.address)
          await liquidityPool.setTargetAssetParams(newTargetParams0)
          //mintable2 is now targetted at 0
          const maxWithdrawal = await liquidityPool.getSpecificReserves(mintable2.target)
          await expect(
            liquidityPool.swapTowardsTarget(
              mintable2.target,
              maxWithdrawal * -1n
            )
          ).not.to.be.reverted
        })

        it("should apply an equalization bounty if one is set", async function() {
          const { liquidityPool, mintable2, newTargetParams0, admin, indexToken } = await loadFixture(deployAll)
          await liquidityPool.mint(utils.scale10Pow18(1_000_000n), admin.address)
          await liquidityPool.setTargetAssetParams(newTargetParams0)
          const bounty = utils.scale10Pow18(1_000n)
          await liquidityPool.setEqualizationBounty(bounty)
          const maxWithdrawal = await liquidityPool.getSpecificReserves(mintable2.target)
          const indexTokenBalanceBefore = await indexToken.balanceOf(admin.address)
          await expect(liquidityPool.swapTowardsTarget(
            mintable2.target,
            maxWithdrawal * -1n
          )).not.to.be.reverted
          const indexTokenBalanceAfter = await indexToken.balanceOf(admin.address)
          const indexTokensPaid = indexTokenBalanceBefore - indexTokenBalanceAfter
          console.log("maxWithdrawal:", utils.scaleDecimals(maxWithdrawal, 6n, 18n), bounty)
          expect(indexTokensPaid).to.equal(utils.scaleDecimals(maxWithdrawal, 6n, 18n) - bounty)
        })

        it("should set the bounty exactly to the burn amount if it is greater than the burn amount", async function() {

        })
      })

      describe("Deposit", function() {
        it("should not allow swapping that increases discrepency", async function() {
          const { 
            liquidityPool,
            mintable2, 
            admin, 
            newTargetParams0, 
            assetParams0, 
            assetParams1, 
            assetParams2 
          } = await loadFixture(deployAll)
          //remove mintable2 from the pool and equalize
          await liquidityPool.setTargetAssetParams(newTargetParams0)
          await liquidityPool.equalizeToTarget()
          //mint tokens and then add mintable2 back to the pool
          await liquidityPool.mint(utils.scale10Pow18(1_000_000n), admin.address)
          await liquidityPool.setTargetAssetParams([assetParams0, assetParams1, assetParams2])
          //mintable2 is now targetted at 0.33
          await expect(
            liquidityPool.swapTowardsTarget(
              mintable2.target,
              -1n
            )
          ).to.be.revertedWith("withdrawal exceeds target allocation")
          await expect(
            liquidityPool.swapTowardsTarget(
              mintable2.target,
              1n
            )
          ).not.to.be.reverted
        })

        it("should not allow swapping that passes the target allocation", async function() {
          const { 
            liquidityPool,
            mintable2, 
            admin, 
            newTargetParams0, 
            assetParams0, 
            assetParams1, 
            assetParams2,
            poolMathWrapper
          } = await loadFixture(deployAll)
          //remove mintable2 from the pool and equalize
          await liquidityPool.setTargetAssetParams(newTargetParams0)
          await liquidityPool.equalizeToTarget()
          //mint tokens and then add mintable2 back to the pool
          await liquidityPool.mint(utils.scale10Pow18(1_000_000n), admin.address)
          await liquidityPool.setTargetAssetParams([assetParams0, assetParams1, assetParams2])
          //mintable2 is now targetted at 0.33
          const maxDeltaScaled = await poolMathWrapper.calcMaxIndividualDelta(assetParams2.targetAllocation, 0n, await liquidityPool.getTotalReservesScaled())
          await expect(
            liquidityPool.swapTowardsTarget(
              mintable2.target,
              maxDeltaScaled + 1n
            )
          ).to.be.revertedWith("deposit exceeds target allocation")
        })

        it("should swap exactly to the target", async function() {
          const { 
            liquidityPool,
            mintable2, 
            admin, 
            newTargetParams0, 
            assetParams0, 
            assetParams1, 
            assetParams2,
            poolMathWrapper
          } = await loadFixture(deployAll)
          //remove mintable2 from the pool and equalize
          await liquidityPool.setTargetAssetParams(newTargetParams0)
          await liquidityPool.equalizeToTarget()
          //mint tokens and then add mintable2 back to the pool
          await liquidityPool.mint(utils.scale10Pow18(1_000_000n), admin.address)
          await liquidityPool.setTargetAssetParams([assetParams0, assetParams1, assetParams2])
          //mintable2 is now targetted at 0.33
          const maxDeltaScaled = await poolMathWrapper.calcMaxIndividualDelta(assetParams2.targetAllocation, 0n, await liquidityPool.getTotalReservesScaled())
          console.log("maxDelta:", maxDeltaScaled)
          await expect(
            liquidityPool.swapTowardsTarget(
              mintable2.target,
              maxDeltaScaled
            )
          ).not.to.be.reverted
        })

        it("should apply an equalization bounty if one is set", async function() {
          const { 
            liquidityPool,
            mintable2, 
            admin, 
            newTargetParams0, 
            assetParams0, 
            assetParams1, 
            assetParams2 
          } = await loadFixture(deployAll)
          //remove mintable2 from the pool and equalize
          await liquidityPool.setTargetAssetParams(newTargetParams0)
          await liquidityPool.equalizeToTarget()
          //mint tokens and then add mintable2 back to the pool
          await liquidityPool.mint(utils.scale10Pow18(1_000_000n), admin.address)
          await liquidityPool.setTargetAssetParams([assetParams0, assetParams1, assetParams2])
          //mintable2 is now targetted at 0.33
        })
      })
    })

    describe("swap token above standard decimal scale", function() {
      describe("Withdraw", function() {

      })

      describe("Deposit", function() {
        
      })
    })
  })

  describe("equalizeToTarget", function() {
    it("equalizes the pool", async function() {

    })

    it("removes zero allocation assets from assetParams_ map and currentAssetParams_ list", async function() {

    })

    it("applies reserves tracking and token transfers correctly", async function() {

    })

    it("distributes the entire equalization bounty to the caller", async function() {
      
    })
  })
});
