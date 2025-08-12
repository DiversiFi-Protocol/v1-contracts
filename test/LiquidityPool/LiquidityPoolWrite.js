const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const utils = require("../testModules/utils.js");
const deployAll = require("../deployAll.js");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

async function increaseTime(seconds) {
  await ethers.provider.send("evm_increaseTime", [seconds]);

  // Mine a new block so the increased time takes effect
  await ethers.provider.send("evm_mine", []);
}

describe("ReserveManager - Mint/Burn Functions", function () {
  describe("mint", function () {
    it("mints liquidity tokens and updates reserves as expected", async function () {
      const { poolMathWrapper, reserveManager, indexToken, admin, mintable0, mintable1, mintable2, assetParams0, assetParams1, assetParams2 } = await loadFixture(deployAll);
      const mintAmount = utils.scale10Pow18(3000n);
      const prevBal0 = await mintable0.balanceOf(admin.address);
      const prevBal1 = await mintable1.balanceOf(admin.address);
      const prevBal2 = await mintable2.balanceOf(admin.address);
      const prevLiquidityBal = await indexToken.balanceOf(admin.address);
      const prevSurplus = await reserveManager.getSurplus()
      const compoundingFeeRate = await poolMathWrapper.calcCompoundingFeeRate(await reserveManager.getMintFeeQ96())
      const fee = (mintAmount * compoundingFeeRate) >> 96n
      const mintAmountPlusFee = mintAmount + fee
      await expect(
        reserveManager.connect(admin).mint(mintAmount, "0x")
      ).to.emit(reserveManager, "Mint");

      const balance0 = await mintable0.balanceOf(admin.address);
      const balance1 = await mintable1.balanceOf(admin.address);
      const balance2 = await mintable2.balanceOf(admin.address);
      const liquidityBal = await indexToken.balanceOf(admin.address);
      const surplus = await reserveManager.getSurplus()

      // check that the mint fee accrues as surplus of reserves to total supply
      expect(surplus - prevSurplus).to.be.greaterThanOrEqual(fee)
      expect(surplus - prevSurplus).to.be.closeTo(fee, mintAmountPlusFee / 1_000_000_000n)

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
      const scaledReserves0 = await reserveManager.getSpecificReservesScaled(mintable0.target);
      const scaledReserves1 = await reserveManager.getSpecificReservesScaled(mintable1.target);
      const scaledReserves2 = await reserveManager.getSpecificReservesScaled(mintable2.target);
      expect(scaledReserves0).to.be.closeTo(expectedReductionScaled0, expectedReductionScaled0 / 1_000_000_000n);
      expect(scaledReserves1).to.be.closeTo(expectedReductionScaled1, expectedReductionScaled1 / 1_000_000_000n);
      expect(scaledReserves2).to.be.closeTo(expectedReductionScaled2, expectedReductionScaled2 / 1_000_000_000n);
      
      //compare balances of contract to scaled reserves
      const contractBalance0 = await mintable0.balanceOf(reserveManager.target);
      const contractBalance1 = await mintable1.balanceOf(reserveManager.target);
      const contractBalance2 = await mintable2.balanceOf(reserveManager.target);
      expect(contractBalance0).to.equal(utils.scaleDecimals(scaledReserves0, 18n, assetParams0.decimals))
      expect(contractBalance1).to.be.closeTo(utils.scaleDecimals(scaledReserves1, 18n, assetParams1.decimals), 1n)//rounding diff because this token has 20 decimal places. in reality this will probably not even matter in the insane case that we even have a token with 20 decimals
      expect(contractBalance2).to.equal(utils.scaleDecimals(scaledReserves2, 18n, assetParams2.decimals))

    });

    it("reverts if minting is disabled", async function () {
      const { reserveManager, maintainer, admin } = await loadFixture(deployAll);
      await reserveManager.connect(maintainer).setIsMintEnabled(false);
      await expect(
        reserveManager.connect(admin).mint(utils.scale10Pow18(1000n), "0x")
      ).to.be.revertedWith("minting disabled");
    });

    it("succeeds when minting exactly up to the maxReserves limit (cooldown active)", async function () {
      const { reserveManager, maintainer, admin } = await loadFixture(deployAll);
      // Set a low maxReserves limit
      const lowLimit = utils.scale10Pow18(1000000n);
      await reserveManager.connect(maintainer).setMaxReserves(lowLimit);
      //set fee to zero so we don't have to do a complex calculation
      await reserveManager.connect(admin).setMintFeeQ96(0n);
      // Mint below the limit
      await expect(
        reserveManager.connect(admin).mint(lowLimit - utils.scale10Pow18(1n), "0x")
      ).to.not.be.reverted;
    });

    it("reverts when minting above the maxReserves limit (cooldown active)", async function () {
      const { reserveManager, maintainer, admin } = await loadFixture(deployAll);
      // Set a low maxReserves limit
      const lowLimit = utils.scale10Pow18(1000000n);
      await reserveManager.connect(maintainer).setMaxReserves(lowLimit);
      //set fee to zero so we don't have to do a complex calculation
      await reserveManager.connect(admin).setMintFeeQ96(0n);
      // Mint below the limit
      await expect(
        reserveManager.connect(admin).mint(lowLimit+utils.scale10Pow18(1n), "0x")
      ).to.be.revertedWith("max reserves limit");
    });

    it("succeeds when minting exactly up to the NEXT maxReserves limit (cooldown inactive)", async function () {
      const { reserveManager, maintainer, admin } = await loadFixture(deployAll);
      // Set a low maxReserves limit
      const lowLimit = utils.scale10Pow18(1000000n);
      await reserveManager.connect(maintainer).setMaxReserves(lowLimit);
      //set fee to zero so we don't have to do a complex calculation
      await reserveManager.connect(admin).setMintFeeQ96(0n);
      // fast forward to cooldown period end
      await time.increase(3600 * 24 + 1); // fast forward 1 day
      // Mint above the limit
      await expect(
        reserveManager.connect(admin).mint(lowLimit+utils.scale10Pow18(1n), "0x")
      ).not.to.be.revertedWith("max reserves limit");
      // get the new limit
      const nextMaxReserves = await reserveManager.getMaxReserves();
      //reload the fixture to its initail state
      const resetVals = await loadFixture(deployAll);
      //set fee to zero so we don't have to do a complex calculation
      await resetVals.reserveManager.connect(resetVals.admin).setMintFeeQ96(0n);
      //set the low limit again
      await resetVals.reserveManager.connect(resetVals.maintainer).setMaxReserves(lowLimit);
      await time.increase(3600 * 24 + 1); // fast forward 1 day
      // mint above the next max reserves limit
      await expect(
        resetVals.reserveManager.connect(resetVals.admin).mint(nextMaxReserves - utils.scale10Pow18(1n), "0x")
      ).not.to.be.revertedWith("max reserves limit");
    });

    it("reverts when minting above the NEXT maxReserves limit (cooldown inactive)", async function () {
      const { reserveManager, maintainer, admin } = await loadFixture(deployAll);
      // Set a low maxReserves limit
      const lowLimit = utils.scale10Pow18(1000000n);
      await reserveManager.connect(maintainer).setMaxReserves(lowLimit);
      //set fee to zero so we don't have to do a complex calculation
      await reserveManager.connect(admin).setMintFeeQ96(0n);
      // fast forward to cooldown period end
      await time.increase(3600 * 24 + 1); // fast forward 1 day
      // Mint above the limit
      await expect(
        reserveManager.connect(admin).mint(lowLimit + utils.scale10Pow18(1n), "0x")
      ).not.to.be.revertedWith("max reserves limit");
      // get the new limit
      const nextMaxReserves = await reserveManager.getMaxReserves();
      //reload the fixture to its initail state
      const resetVals = await loadFixture(deployAll);
      //set fee to zero so we don't have to do a complex calculation
      await resetVals.reserveManager.connect(resetVals.admin).setMintFeeQ96(0n);
      //set the low limit again
      await resetVals.reserveManager.connect(resetVals.maintainer).setMaxReserves(lowLimit);
      await time.increase(3600 * 24 + 1); // fast forward 1 day
      // mint above the next max reserves limit
      await expect(
        resetVals.reserveManager.connect(resetVals.admin).mint(nextMaxReserves + utils.scale10Pow18(1n), "0x")
      ).to.be.revertedWith("max reserves limit");
    });

    it("reverts if pool is emigrating", async function() {
      const { reserveManager, reserveManager0, indexToken, admin, mintable0, mintable1, mintable2, assetParams0, assetParams1, assetParams2, minbalanceDivisorChangeDelay, maxbalanceDivisorChangePerSecondQ96 } = await loadFixture(deployAll);
      await reserveManager.startEmigration(
        reserveManager0,
        minbalanceDivisorChangeDelay,
        maxbalanceDivisorChangePerSecondQ96
      )
      await expect(reserveManager.mint(42069n, "0x")).to.be.revertedWith("pool is emigrating")
    })

    it("succeeds if pool is being immigrated into", async function() {
      const { reserveManager, reserveManager0, indexToken, admin, mintable0, mintable1, mintable2, assetParams0, assetParams1, assetParams2, minbalanceDivisorChangeDelay, maxbalanceDivisorChangePerSecondQ96 } = await loadFixture(deployAll);
      await reserveManager.startEmigration(
        reserveManager0,
        minbalanceDivisorChangeDelay,
        maxbalanceDivisorChangePerSecondQ96
      )
      await reserveManager0.mint(42069n, "0x")
    })
  });

  describe("burn", function () {
    it("burns liquidity tokens and returns assets as expected", async function () {
      const { reserveManager, indexToken, admin, mintable0, mintable1, mintable2, assetParams0, assetParams1, assetParams2 } = await loadFixture(deployAll);
      const mintAmount = utils.scale10Pow18(1000n);
      await reserveManager.connect(admin).mint(mintAmount, "0x");
      const burnAmount = mintAmount
      const prevBal0 = await mintable0.balanceOf(admin.address);
      const prevBal1 = await mintable1.balanceOf(admin.address);
      const prevBal2 = await mintable2.balanceOf(admin.address);
      const prevLiquidityBal = await indexToken.balanceOf(admin.address);
      const prevSurplus = await reserveManager.getSurplus();
      const fee = (burnAmount * (await reserveManager.getBurnFeeQ96())) >> 96n
      const trueBurnAmount = burnAmount - fee;
      const totalReservesScaled = await reserveManager.getTotalReservesScaled()
      const previousSpecificReservesScaled0 = await reserveManager.getSpecificReservesScaled(assetParams0.assetAddress)
      const previousSpecificReservesScaled1 = await reserveManager.getSpecificReservesScaled(assetParams1.assetAddress)
      const previousSpecificReservesScaled2 = await reserveManager.getSpecificReservesScaled(assetParams2.assetAddress)
      const currentAllocation0 = (previousSpecificReservesScaled0 << 96n) / totalReservesScaled
      const currentAllocation1 = (previousSpecificReservesScaled1 << 96n) / totalReservesScaled
      const currentAllocation2 = (previousSpecificReservesScaled2 << 96n) / totalReservesScaled
      await expect(
        reserveManager.connect(admin).burn(burnAmount, "0x")
      ).to.emit(reserveManager, "Burn");

      const balance0 = await mintable0.balanceOf(admin.address);
      const balance1 = await mintable1.balanceOf(admin.address);
      const balance2 = await mintable2.balanceOf(admin.address);
      const liquidityBal = await indexToken.balanceOf(admin.address);
      const surplus = await reserveManager.getSurplus();

      //check that the burn fee accrues as index token balance to the liquidity pool
      expect(surplus).to.be.greaterThanOrEqual(prevSurplus + fee)
      expect(surplus).to.be.closeTo(prevSurplus + fee, burnAmount / 1_000_000_000n)

      // Check that liquidity tokens were minted
      const targetIncreaseScaled0 = (currentAllocation0 * trueBurnAmount) >> utils.SHIFT
      const targetIncreaseScaled1 = (currentAllocation1 * trueBurnAmount) >> utils.SHIFT
      const targetIncreaseScaled2 = (currentAllocation2 * trueBurnAmount) >> utils.SHIFT

      const expectedIncrease0 = utils.scaleDecimals(targetIncreaseScaled0, 18n, assetParams0.decimals)
      const expectedIncrease1 = utils.scaleDecimals(targetIncreaseScaled1, 18n, assetParams1.decimals)
      const expectedIncrease2 = utils.scaleDecimals(targetIncreaseScaled2, 18n, assetParams2.decimals)

      const expectedIncreaseScaled0 = utils.scaleDecimals(expectedIncrease0, assetParams0.decimals, 18n)
      const expectedIncreaseScaled1 = utils.scaleDecimals(expectedIncrease1, assetParams1.decimals, 18n)
      const expectedIncreaseScaled2 = utils.scaleDecimals(expectedIncrease2, assetParams2.decimals, 18n)

      const actualIncrease0 = balance0 - prevBal0
      const actualIncrease1 = balance1 - prevBal1
      const actualIncrease2 = balance2 - prevBal2

      const specificReservesScaled0 = await reserveManager.getSpecificReservesScaled(assetParams0.assetAddress)
      const specificReservesScaled1 = await reserveManager.getSpecificReservesScaled(assetParams1.assetAddress)
      const specificReservesScaled2 = await reserveManager.getSpecificReservesScaled(assetParams2.assetAddress)

      const actualIncreaseScaled0 = previousSpecificReservesScaled0 - specificReservesScaled0
      const actualIncreaseScaled1 = previousSpecificReservesScaled1 - specificReservesScaled1
      const actualIncreaseScaled2 = previousSpecificReservesScaled2 - specificReservesScaled2

      //expect internal scaled reserves to reflect the expected change
      expect(actualIncreaseScaled0).to.equal(expectedIncreaseScaled0)
      expect(actualIncreaseScaled1).to.equal(expectedIncreaseScaled1)
      expect(actualIncreaseScaled2).to.equal(expectedIncreaseScaled2)

      // Check that liquidity tokens were burned
      expect(prevLiquidityBal - liquidityBal).to.equal(burnAmount);
      // Check that assets were returned to the burner
      expect(actualIncrease0).to.equal(expectedIncrease0);
      expect(actualIncrease1).to.equal(expectedIncrease1);
      expect(actualIncrease2).to.equal(expectedIncrease2);
    });
    
    it("should give a discount if migrating", async function() {
      const {
        indexToken, reserveManager, reserveManager0, reserveManager1, reserveManager2, reserveManager3, reserveManager4, 
        admin, unpriviledged, tokenName, tokenSymbol, mintable0, mintable1, mintable2, maxReserves, maxReservesIncreaseRateQ96, 
        assetParams0, assetParams1, assetParams2, setMaxReservesTimestamp, poolMathWrapper, assetParamsNoMintable0, 
        assetParamsNoMintable1, assetParamsNoMintable2, minbalanceDivisorChangeDelay, maxbalanceDivisorChangePerSecondQ96,
        reserveManagerHelpers, reserveManagerHelpers0, reserveManagerHelpers1, reserveManagerHelpers2, reserveManagerHelpers3, reserveManagerHelpers4,
      } = await loadFixture(deployAll)
      await reserveManager.setMintFeeQ96(0)
      const balance0Initial = await mintable0.balanceOf(admin)
      const balance1Initial = await mintable1.balanceOf(admin)
      const balance2Initial = await mintable2.balanceOf(admin)
      await reserveManager.mint(utils.scale10Pow18(1_000_000_000n), "0x")
      const balance0PostMint = await mintable0.balanceOf(admin)
      const balance1PostMint = await mintable1.balanceOf(admin)
      const balance2PostMint = await mintable2.balanceOf(admin)
      const initialAmount0Paid = BigInt(balance0Initial - balance0PostMint)
      const initialAmount1Paid = BigInt(balance1Initial - balance1PostMint)
      const initialAmount2Paid = BigInt(balance2Initial - balance2PostMint)
      await reserveManager.startEmigration(
        reserveManager0,
        minbalanceDivisorChangeDelay,
        maxbalanceDivisorChangePerSecondQ96
      )
      await increaseTime(Number(minbalanceDivisorChangeDelay) + 100)
      const balance0Before = await mintable0.balanceOf(admin)
      const balance1Before = await mintable1.balanceOf(admin)
      const balance2Before = await mintable2.balanceOf(admin)
      await reserveManagerHelpers.burnAll()
      const balance0After = await mintable0.balanceOf(admin)
      const balance1After = await mintable1.balanceOf(admin)
      const balance2After = await mintable2.balanceOf(admin)
      const migratingAmount0Received = balance0After - balance0Before
      const migratingAmount1Received = balance1After - balance1Before
      const migratingAmount2Received = balance2After - balance2Before
      //it should recieve back the same amount that it paid even though its balance has decreased
      expect(migratingAmount0Received).to.be.closeTo(initialAmount0Paid, initialAmount0Paid / 1_000_000_000_000n)
      expect(migratingAmount1Received).to.be.closeTo(initialAmount1Paid, initialAmount1Paid / 1_000_000_000_000n)
      expect(migratingAmount2Received).to.be.closeTo(initialAmount2Paid, initialAmount2Paid / 1_000_000_000_000n)
    })

    it("reverts if user tries to burn more than their balance", async function () {
      const { reserveManager, indexToken, admin } = await loadFixture(deployAll);
      const mintAmount = utils.scale10Pow18(1000n);
      await reserveManager.connect(admin).mint(mintAmount, "0x");
      await indexToken.connect(admin).approve(reserveManager.target, mintAmount + 1n);
      await expect(
        reserveManager.connect(admin).burn(mintAmount + 1n, "0x")
      ).to.be.reverted;
    });

    it("succeeds if pool is emigrating", async function() {
      const { reserveManager, reserveManager0, indexToken, admin, mintable0, mintable1, mintable2, assetParams0, assetParams1, assetParams2, minbalanceDivisorChangeDelay, maxbalanceDivisorChangePerSecondQ96 } = await loadFixture(deployAll);
      await reserveManager.mint(52069n, "0x")
      await reserveManager.startEmigration(
        reserveManager0,
        minbalanceDivisorChangeDelay,
        maxbalanceDivisorChangePerSecondQ96
      )
      await reserveManager.burn(42069n, "0x")
    })

    it("fails if pool is being immigrated into", async function() {
      const { reserveManager, reserveManager0, indexToken, admin, mintable0, mintable1, mintable2, assetParams0, assetParams1, assetParams2, minbalanceDivisorChangeDelay, maxbalanceDivisorChangePerSecondQ96 } = await loadFixture(deployAll);
      await reserveManager.startEmigration(
        reserveManager0,
        minbalanceDivisorChangeDelay,
        maxbalanceDivisorChangePerSecondQ96
      )
      await reserveManager0.mint(52069n, "0x")
      await expect(reserveManager0.burn(42069n, "0x")).to.be.revertedWith("only liquidity pool")
    })
  });

  describe("swapTowardsTarget", function() {
    describe("swap token equal to standard decimal scale", function() {
      describe("Withdraw", function() {
        it("should not allow swapping if the pool is equalized", async function() {
          const { reserveManager, mintable0 } = await loadFixture(deployAll)
          await expect(
            reserveManager.swapTowardsTarget(
              mintable0.target,
              -1n
            )
          ).to.be.revertedWith("withdrawal exceeds target allocation")
          await expect(
            reserveManager.swapTowardsTarget(
              mintable0.target,
              1n
            )
          ).to.be.revertedWith("deposit exceeds target allocation")
        })

        it("should not allow swapping that increases discrepency", async function() {
          const { reserveManager, mintable0, assetParamsNoMintable0, admin } = await loadFixture(deployAll)
          await reserveManager.mint(utils.scale10Pow18(1_000_000n), "0x")
          await reserveManager.setTargetAssetParams(assetParamsNoMintable0)
          //mintable0 is now targetted at 0
          await expect(
            reserveManager.swapTowardsTarget(
              mintable0.target,
              -1n
            )
          ).not.to.be.reverted
          await expect(
            reserveManager.swapTowardsTarget(
              mintable0.target,
              1n
            )
          ).to.be.revertedWith("deposit exceeds target allocation")
        })

        it("should not allow swapping that passes the target allocation", async function() {
          const { reserveManager, mintable0, assetParamsNoMintable0, admin } = await loadFixture(deployAll)
          await reserveManager.mint(utils.scale10Pow18(1_000_000n), "0x")
          await reserveManager.setTargetAssetParams(assetParamsNoMintable0)
          //mintable0 is now targetted at 0
          const maxWithdrawal = await reserveManager.getSpecificReserves(mintable0.target)
          await expect(
            reserveManager.swapTowardsTarget(
              mintable0.target,
              (maxWithdrawal * -1n) - 1n
            )
          ).to.be.revertedWith("withdrawal exceeds target allocation")
        })

        it("should swap exactly to the target", async function() {
          const { reserveManager, mintable0, assetParamsNoMintable0, admin, indexToken } = await loadFixture(deployAll)
          await reserveManager.mint(utils.scale10Pow18(1_000_000n), "0x")
          await reserveManager.setTargetAssetParams(assetParamsNoMintable0)
          //mintable0 is now targetted at 0
          const callerReserveBalanceBefore = await mintable0.balanceOf(admin.address);
          const poolReserveBalanceBefore = await mintable0.balanceOf(reserveManager.target);
          const poolTotalReservesScaledBefore = await reserveManager.getTotalReservesScaled()
          const poolStorageReservesBefore = await reserveManager.getSpecificReserves(mintable0.target);
          const callerIndexBalanceBefore = await indexToken.balanceOf(admin.address);
          const maxWithdrawal = await reserveManager.getSpecificReserves(mintable0.target)
          await expect(
            reserveManager.swapTowardsTarget(
              mintable0.target,
              maxWithdrawal * -1n
            )
          ).not.to.be.reverted
          const callerReserveBalanceAfter = await mintable0.balanceOf(admin.address);
          const poolReserveBalanceAfter = await mintable0.balanceOf(reserveManager.target);
          const poolTotalReservesScaledAfter = await reserveManager.getTotalReservesScaled()
          const poolStorageReservesAfter = await reserveManager.getSpecificReserves(mintable0.target);
          const callerIndexBalanceAfter = await indexToken.balanceOf(admin.address);
          expect(callerReserveBalanceAfter - callerReserveBalanceBefore).to.equal(maxWithdrawal)
          expect(poolReserveBalanceBefore - poolReserveBalanceAfter).to.equal(maxWithdrawal)
          expect(poolTotalReservesScaledBefore - poolTotalReservesScaledAfter).to.equal(utils.scaleDecimals(maxWithdrawal, assetParams0.decimals, 18n))
          expect(poolStorageReservesBefore - poolStorageReservesAfter).to.equal(maxWithdrawal)
          expect(callerIndexBalanceBefore - callerIndexBalanceAfter).to.equal(utils.scaleDecimals(maxWithdrawal, assetParams0.decimals, 18n))
        })

        it("should apply an equalization bounty if one is set", async function() {
          const { reserveManager, mintable0, assetParamsNoMintable0, admin, indexToken, assetParams0 } = await loadFixture(deployAll)
          await reserveManager.mint(utils.scale10Pow18(1_000_000n), "0x")
          await reserveManager.setTargetAssetParams(assetParamsNoMintable0)
          const bounty = utils.scale10Pow18(1_000n)
          await indexToken.transfer(reserveManager, bounty)
          await reserveManager.increaseEqualizationBounty(bounty)
          const maxWithdrawal = await reserveManager.getSpecificReserves(mintable0.target)
          const indexTokenBalanceBefore = await indexToken.balanceOf(admin.address)
          await expect(reserveManager.swapTowardsTarget(
            mintable0.target,
            maxWithdrawal * -1n
          )).not.to.be.reverted
          const indexTokenBalanceAfter = await indexToken.balanceOf(admin.address)
          const indexTokensPaid = indexTokenBalanceBefore - indexTokenBalanceAfter
          const expectedTokensPaid = utils.scaleDecimals(maxWithdrawal, assetParams0.decimals, 18n) - bounty
          expect(indexTokensPaid).to.be.closeTo(expectedTokensPaid, expectedTokensPaid / 1_000_000_000_000n)
        })

        it("should set the bounty exactly to the burn amount if it is greater than the burn amount", async function() {
          const { reserveManager, mintable0, assetParamsNoMintable0, admin, indexToken } = await loadFixture(deployAll)
          await reserveManager.mint(utils.scale10Pow18(1_000_000n), "0x")
          await reserveManager.setTargetAssetParams(assetParamsNoMintable0)
          const bounty = utils.scale10Pow18(1_000_000n)
          await indexToken.burn(bounty)
          await reserveManager.increaseEqualizationBounty(bounty)
          const maxWithdrawal = await reserveManager.getSpecificReserves(mintable0.target)
          const indexTokenBalanceBefore = await indexToken.balanceOf(admin.address)
          await expect(reserveManager.swapTowardsTarget(
            mintable0.target,
            maxWithdrawal * -1n
          )).not.to.be.reverted
          const indexTokenBalanceAfter = await indexToken.balanceOf(admin.address)
          const indexTokensPaid = indexTokenBalanceBefore - indexTokenBalanceAfter
          expect(indexTokensPaid).to.equal(0n)
        })
      })

      describe("Deposit", function() {
        it("should not allow swapping that increases discrepency", async function() {
          const { 
            reserveManager,
            mintable0, 
            admin, 
            assetParamsNoMintable0, 
            assetParams0, 
            assetParams1, 
            assetParams2 
          } = await loadFixture(deployAll)
          //remove mintable0 from the pool and equalize
          await reserveManager.setTargetAssetParams(assetParamsNoMintable0)
          await reserveManager.equalizeToTarget()
          //mint tokens and then add mintable0 back to the pool
          await reserveManager.mint(utils.scale10Pow18(1_000_000n), "0x")
          await reserveManager.setTargetAssetParams([assetParams0, assetParams1, assetParams2])
          //mintable0 is now targetted at 0.33
          await expect(
            reserveManager.swapTowardsTarget(
              mintable0.target,
              -1n
            )
          ).to.be.revertedWith("withdrawal exceeds target allocation")
          await expect(
            reserveManager.swapTowardsTarget(
              mintable0.target,
              1n
            )
          ).not.to.be.reverted
        })

        it("should not allow swapping that passes the target allocation", async function() {
          const { 
            reserveManager,
            mintable0, 
            admin, 
            assetParamsNoMintable0, 
            assetParams0, 
            assetParams1, 
            assetParams2,
            poolMathWrapper
          } = await loadFixture(deployAll)
          //remove mintable0 from the pool and equalize
          await reserveManager.setTargetAssetParams(assetParamsNoMintable0)
          await reserveManager.equalizeToTarget()
          //mint tokens and then add mintable0 back to the pool
          await reserveManager.mint(utils.scale10Pow18(1_000_000n), "0x")
          await reserveManager.setTargetAssetParams([assetParams0, assetParams1, assetParams2])
          //mintable0 is now targetted at 0.33
          const maxDeltaScaled = await poolMathWrapper.calcMaxIndividualDelta(assetParams0.targetAllocation, 0n, await reserveManager.getTotalReservesScaled())
          await expect(
            reserveManager.swapTowardsTarget(
              mintable0.target,
              utils.scaleDecimals(maxDeltaScaled, 18n, assetParams0.decimals) + 1n
            )
          ).to.be.revertedWith("deposit exceeds target allocation")
        })

        it("should not allow a deposit that exceeds the max reserves limit", async function() {
          const { 
            reserveManager,
            mintable0, 
            maintainer, 
            assetParamsNoMintable0, 
            assetParams0, 
            assetParams1, 
            assetParams2,
            poolMathWrapper
          } = await loadFixture(deployAll)
          //remove mintable0 from the pool and equalize
          await reserveManager.setTargetAssetParams(assetParamsNoMintable0)
          await reserveManager.equalizeToTarget()
          //mint tokens and then add mintable0 back to the pool
          await reserveManager.mint(utils.scale10Pow18(1_000_000n), "0x")
          await reserveManager.setTargetAssetParams([assetParams0, assetParams1, assetParams2])
          //mintable0 is now targetted at 0.33
          await reserveManager.connect(maintainer).setMaxReserves(utils.scale10Pow18(900_000n))
          const maxDeltaScaled = await poolMathWrapper.calcMaxIndividualDelta(assetParams0.targetAllocation, 0n, await reserveManager.getTotalReservesScaled())
          await expect(
            reserveManager.swapTowardsTarget(
              mintable0.target,
              utils.scaleDecimals(maxDeltaScaled, 18n, assetParams0.decimals)
            )
          ).to.be.revertedWith("max reserves limit")
        })

        it("should swap exactly to the target", async function() {
          const { 
            reserveManager,
            mintable0, 
            admin, 
            assetParamsNoMintable0, 
            assetParams0, 
            assetParams1, 
            assetParams2,
            poolMathWrapper,
            indexToken
          } = await loadFixture(deployAll)
          //remove mintable0 from the pool and equalize
          await reserveManager.setTargetAssetParams(assetParamsNoMintable0)
          await reserveManager.equalizeToTarget()
          //mint tokens and then add mintable0 back to the pool
          await reserveManager.mint(utils.scale10Pow18(1_000_000n), "0x")
          await reserveManager.setTargetAssetParams([assetParams0, assetParams1, assetParams2])
          //mintable0 is now targetted at 0.33
          const callerReserveBalanceBefore = await mintable0.balanceOf(admin.address);
          const poolReserveBalanceBefore = await mintable0.balanceOf(reserveManager.target);
          const poolTotalReservesScaledBefore = await reserveManager.getTotalReservesScaled()
          const poolStorageReservesBefore = await reserveManager.getSpecificReserves(mintable0.target);
          const callerIndexBalanceBefore = await indexToken.balanceOf(admin.address);
          const maxDeltaScaled = await poolMathWrapper.calcMaxIndividualDelta(assetParams0.targetAllocation, 0n, await reserveManager.getTotalReservesScaled())
          const maxDeposit = utils.scaleDecimals(maxDeltaScaled, 18n, assetParams0.decimals)
          await expect(
            reserveManager.swapTowardsTarget(
              mintable0.target,
              maxDeposit
            )
          ).not.to.be.reverted
          const callerReserveBalanceAfter = await mintable0.balanceOf(admin.address);
          const poolReserveBalanceAfter = await mintable0.balanceOf(reserveManager.target);
          const poolTotalReservesScaledAfter = await reserveManager.getTotalReservesScaled()
          const poolStorageReservesAfter = await reserveManager.getSpecificReserves(mintable0.target);
          const callerIndexBalanceAfter = await indexToken.balanceOf(admin.address);
          expect(callerReserveBalanceBefore - callerReserveBalanceAfter).to.equal(maxDeposit)
          expect(poolReserveBalanceAfter - poolReserveBalanceBefore).to.equal(maxDeposit)
          expect(poolTotalReservesScaledAfter - poolTotalReservesScaledBefore).to.equal(utils.scaleDecimals(maxDeposit, assetParams0.decimals, 18n))
          expect(poolStorageReservesAfter - poolStorageReservesBefore).to.equal(maxDeposit)
          expect(callerIndexBalanceAfter - callerIndexBalanceBefore).to.equal(utils.scaleDecimals(maxDeposit, assetParams0.decimals, 18n))
        })

        it("should apply an equalization bounty if one is set", async function() {
          const { 
            reserveManager,
            mintable0, 
            admin, 
            assetParamsNoMintable0, 
            assetParams0, 
            assetParams1, 
            assetParams2,
            poolMathWrapper,
            indexToken
          } = await loadFixture(deployAll)
          //remove mintable0 from the pool and equalize
          await reserveManager.setTargetAssetParams(assetParamsNoMintable0)
          await reserveManager.equalizeToTarget()
          //mint tokens and then add mintable0 back to the pool
          await reserveManager.mint(utils.scale10Pow18(1_000_000n), "0x")
          await reserveManager.setTargetAssetParams([assetParams0, assetParams1, assetParams2])
          const bounty = utils.scale10Pow18(1_000n)
          await indexToken.transfer(reserveManager, bounty)
          await reserveManager.increaseEqualizationBounty(bounty)
          //mintable0 is now targetted at 0.33
          const maxDeltaScaled = await poolMathWrapper.calcMaxIndividualDelta(assetParams0.targetAllocation, 0n, await reserveManager.getTotalReservesScaled())
          const maxDeposit = utils.scaleDecimals(maxDeltaScaled, 18n, assetParams0.decimals)
          const indexTokenBalanceBefore = await indexToken.balanceOf(admin.address)
          await expect(reserveManager.swapTowardsTarget(
            mintable0.target,
            maxDeposit
          )).not.to.be.reverted
          const indexTokenBalanceAfter = await indexToken.balanceOf(admin.address)
          const indexTokensReceived = indexTokenBalanceAfter - indexTokenBalanceBefore
          const expectedReceived = utils.scaleDecimals(maxDeposit, assetParams0.decimals, 18n) + bounty
          expect(indexTokensReceived).to.be.closeTo(expectedReceived, expectedReceived / 1_000_000_000_000n) //within 1 trillionth
        })
      })
    })

    describe("swap token below standard decimal scale", function() {
      describe("Withdraw", function() {
        it("should not allow swapping if the pool is equalized", async function() {
          const { reserveManager, mintable2 } = await loadFixture(deployAll)
          await expect(
            reserveManager.swapTowardsTarget(
              mintable2.target,
              -1n
            )
          ).to.be.revertedWith("withdrawal exceeds target allocation")
          await expect(
            reserveManager.swapTowardsTarget(
              mintable2.target,
              1n
            )
          ).to.be.revertedWith("deposit exceeds target allocation")
        })

        it("should not allow swapping that increases discrepency", async function() {
          const { reserveManager, mintable2, assetParamsNoMintable2, admin } = await loadFixture(deployAll)
          await reserveManager.mint(utils.scale10Pow18(1_000_000n), "0x")
          await reserveManager.setTargetAssetParams(assetParamsNoMintable2)
          //mintable2 is now targetted at 0
          await expect(
            reserveManager.swapTowardsTarget(
              mintable2.target,
              -1n
            )
          ).not.to.be.reverted
          await expect(
            reserveManager.swapTowardsTarget(
              mintable2.target,
              1n
            )
          ).to.be.revertedWith("deposit exceeds target allocation")
        })

        it("should not allow swapping that passes the target allocation", async function() {
          const { reserveManager, mintable2, assetParamsNoMintable2, admin } = await loadFixture(deployAll)
          await reserveManager.mint(utils.scale10Pow18(1_000_000n), "0x")
          await reserveManager.setTargetAssetParams(assetParamsNoMintable2)
          //mintable2 is now targetted at 0
          const maxWithdrawal = await reserveManager.getSpecificReserves(mintable2.target)
          await expect(
            reserveManager.swapTowardsTarget(
              mintable2.target,
              (maxWithdrawal * -1n) - 1n
            )
          ).to.be.revertedWith("withdrawal exceeds target allocation")
        })

        it("should swap exactly to the target", async function() {
          const { reserveManager, mintable2, assetParamsNoMintable2, admin, indexToken } = await loadFixture(deployAll)
          await reserveManager.mint(utils.scale10Pow18(1_000_000n), "0x")
          await reserveManager.setTargetAssetParams(assetParamsNoMintable2)
          //mintable2 is now targetted at 0
          const callerReserveBalanceBefore = await mintable2.balanceOf(admin.address);
          const poolReserveBalanceBefore = await mintable2.balanceOf(reserveManager.target);
          const poolTotalReservesScaledBefore = await reserveManager.getTotalReservesScaled()
          const poolStorageReservesBefore = await reserveManager.getSpecificReserves(mintable2.target);
          const callerIndexBalanceBefore = await indexToken.balanceOf(admin.address);
          const maxWithdrawal = await reserveManager.getSpecificReserves(mintable2.target)
          await expect(
            reserveManager.swapTowardsTarget(
              mintable2.target,
              maxWithdrawal * -1n
            )
          ).not.to.be.reverted
          const callerReserveBalanceAfter = await mintable2.balanceOf(admin.address);
          const poolReserveBalanceAfter = await mintable2.balanceOf(reserveManager.target);
          const poolTotalReservesScaledAfter = await reserveManager.getTotalReservesScaled()
          const poolStorageReservesAfter = await reserveManager.getSpecificReserves(mintable2.target);
          const callerIndexBalanceAfter = await indexToken.balanceOf(admin.address);
          expect(callerReserveBalanceAfter - callerReserveBalanceBefore).to.equal(maxWithdrawal)
          expect(poolReserveBalanceBefore - poolReserveBalanceAfter).to.equal(maxWithdrawal)
          expect(poolTotalReservesScaledBefore - poolTotalReservesScaledAfter).to.equal(utils.scaleDecimals(maxWithdrawal, assetParams2.decimals, 18n))
          expect(poolStorageReservesBefore - poolStorageReservesAfter).to.equal(maxWithdrawal)
          expect(callerIndexBalanceBefore - callerIndexBalanceAfter).to.equal(utils.scaleDecimals(maxWithdrawal, assetParams2.decimals, 18n))
        })

        it("should apply an equalization bounty if one is set", async function() {
          const { reserveManager, mintable2, assetParamsNoMintable2, admin, indexToken, assetParams2 } = await loadFixture(deployAll)
          await reserveManager.mint(utils.scale10Pow18(1_000_000n), "0x")
          await reserveManager.setTargetAssetParams(assetParamsNoMintable2)
          const bounty = utils.scale10Pow18(1_000n)
          await indexToken.transfer(reserveManager, bounty)
          await reserveManager.increaseEqualizationBounty(bounty)
          const maxWithdrawal = await reserveManager.getSpecificReserves(mintable2.target)
          const indexTokenBalanceBefore = await indexToken.balanceOf(admin.address)
          await expect(reserveManager.swapTowardsTarget(
            mintable2.target,
            maxWithdrawal * -1n
          )).not.to.be.reverted
          const indexTokenBalanceAfter = await indexToken.balanceOf(admin.address)
          const indexTokensPaid = indexTokenBalanceBefore - indexTokenBalanceAfter
          expect(indexTokensPaid).to.be.closeTo(utils.scaleDecimals(maxWithdrawal, assetParams2.decimals, 18n) - bounty, 1n)
        })

        it("should set the bounty exactly to the burn amount if it is greater than the burn amount", async function() {
          const { reserveManager, mintable2, assetParamsNoMintable2, admin, indexToken } = await loadFixture(deployAll)
          await reserveManager.mint(utils.scale10Pow18(1_000_000n), "0x")
          await reserveManager.setTargetAssetParams(assetParamsNoMintable2)
          const bounty = utils.scale10Pow18(1_000_000n)
          await indexToken.burn(bounty)
          await reserveManager.increaseEqualizationBounty(bounty)
          const maxWithdrawal = await reserveManager.getSpecificReserves(mintable2.target)
          const indexTokenBalanceBefore = await indexToken.balanceOf(admin.address)
          await expect(reserveManager.swapTowardsTarget(
            mintable2.target,
            maxWithdrawal * -1n
          )).not.to.be.reverted
          const indexTokenBalanceAfter = await indexToken.balanceOf(admin.address)
          const indexTokensPaid = indexTokenBalanceBefore - indexTokenBalanceAfter
          expect(indexTokensPaid).to.equal(0n)
        })
      })

      describe("Deposit", function() {
        it("should not allow swapping that increases discrepency", async function() {
          const { 
            reserveManager,
            mintable2, 
            admin, 
            assetParamsNoMintable2, 
            assetParams0, 
            assetParams1, 
            assetParams2 
          } = await loadFixture(deployAll)
          //remove mintable2 from the pool and equalize
          await reserveManager.setTargetAssetParams(assetParamsNoMintable2)
          await reserveManager.equalizeToTarget()
          //mint tokens and then add mintable2 back to the pool
          await reserveManager.mint(utils.scale10Pow18(1_000_000n), "0x")
          await reserveManager.setTargetAssetParams([assetParams0, assetParams1, assetParams2])
          //mintable2 is now targetted at 0.33
          await expect(
            reserveManager.swapTowardsTarget(
              mintable2.target,
              -1n
            )
          ).to.be.revertedWith("withdrawal exceeds target allocation")
          await expect(
            reserveManager.swapTowardsTarget(
              mintable2.target,
              1n
            )
          ).not.to.be.reverted
        })

        it("should not allow swapping that passes the target allocation", async function() {
          const { 
            reserveManager,
            mintable2, 
            admin, 
            assetParamsNoMintable2, 
            assetParams0, 
            assetParams1, 
            assetParams2,
            poolMathWrapper
          } = await loadFixture(deployAll)
          //remove mintable2 from the pool and equalize
          await reserveManager.setTargetAssetParams(assetParamsNoMintable2)
          await reserveManager.equalizeToTarget()
          //mint tokens and then add mintable2 back to the pool
          await reserveManager.mint(utils.scale10Pow18(1_000_000n), "0x")
          await reserveManager.setTargetAssetParams([assetParams0, assetParams1, assetParams2])
          //mintable2 is now targetted at 0.33
          const maxDeltaScaled = await poolMathWrapper.calcMaxIndividualDelta(assetParams2.targetAllocation, 0n, await reserveManager.getTotalReservesScaled())
          await expect(
            reserveManager.swapTowardsTarget(
              mintable2.target,
              utils.scaleDecimals(maxDeltaScaled, 18n, assetParams2.decimals) + 1n
            )
          ).to.be.revertedWith("deposit exceeds target allocation")
        })

        it("should not allow a deposit that exceeds the max reserves limit", async function() {
          const { 
            reserveManager,
            mintable2, 
            maintainer, 
            assetParamsNoMintable2, 
            assetParams0, 
            assetParams1, 
            assetParams2,
            poolMathWrapper
          } = await loadFixture(deployAll)
          //remove mintable2 from the pool and equalize
          await reserveManager.setTargetAssetParams(assetParamsNoMintable2)
          await reserveManager.equalizeToTarget()
          //mint tokens and then add mintable2 back to the pool
          await reserveManager.mint(utils.scale10Pow18(1_000_000n), "0x")
          await reserveManager.setTargetAssetParams([assetParams0, assetParams1, assetParams2])
          //mintable2 is now targetted at 0.33
          await reserveManager.connect(maintainer).setMaxReserves(utils.scale10Pow18(900_000n))
          const maxDeltaScaled = await poolMathWrapper.calcMaxIndividualDelta(assetParams2.targetAllocation, 0n, await reserveManager.getTotalReservesScaled())
          await expect(
            reserveManager.swapTowardsTarget(
              mintable2.target,
              utils.scaleDecimals(maxDeltaScaled, 18n, assetParams2.decimals)
            )
          ).to.be.revertedWith("max reserves limit")
        })

        it("should swap exactly to the target", async function() {
          const { 
            reserveManager,
            mintable2, 
            admin, 
            assetParamsNoMintable2, 
            assetParams0, 
            assetParams1, 
            assetParams2,
            poolMathWrapper,
            indexToken
          } = await loadFixture(deployAll)
          //remove mintable2 from the pool and equalize
          await reserveManager.setTargetAssetParams(assetParamsNoMintable2)
          await reserveManager.equalizeToTarget()
          //mint tokens and then add mintable2 back to the pool
          await reserveManager.mint(utils.scale10Pow18(1_000_000n), "0x")
          await reserveManager.setTargetAssetParams([assetParams0, assetParams1, assetParams2])
          //mintable2 is now targetted at 0.33
          const callerReserveBalanceBefore = await mintable2.balanceOf(admin.address);
          const poolReserveBalanceBefore = await mintable2.balanceOf(reserveManager.target);
          const poolTotalReservesScaledBefore = await reserveManager.getTotalReservesScaled()
          const poolStorageReservesBefore = await reserveManager.getSpecificReserves(mintable2.target);
          const callerIndexBalanceBefore = await indexToken.balanceOf(admin.address);
          const maxDeltaScaled = await poolMathWrapper.calcMaxIndividualDelta(assetParams2.targetAllocation, 0n, await reserveManager.getTotalReservesScaled())
          const maxDeposit = utils.scaleDecimals(maxDeltaScaled, 18n, assetParams2.decimals)
          await expect(
            reserveManager.swapTowardsTarget(
              mintable2.target,
              maxDeposit
            )
          ).not.to.be.reverted
          const callerReserveBalanceAfter = await mintable2.balanceOf(admin.address);
          const poolReserveBalanceAfter = await mintable2.balanceOf(reserveManager.target);
          const poolTotalReservesScaledAfter = await reserveManager.getTotalReservesScaled()
          const poolStorageReservesAfter = await reserveManager.getSpecificReserves(mintable2.target);
          const callerIndexBalanceAfter = await indexToken.balanceOf(admin.address);
          expect(callerReserveBalanceBefore - callerReserveBalanceAfter).to.equal(maxDeposit)
          expect(poolReserveBalanceAfter - poolReserveBalanceBefore).to.equal(maxDeposit)
          expect(poolTotalReservesScaledAfter - poolTotalReservesScaledBefore).to.equal(utils.scaleDecimals(maxDeposit, assetParams2.decimals, 18n))
          expect(poolStorageReservesAfter - poolStorageReservesBefore).to.equal(maxDeposit)
          expect(callerIndexBalanceAfter - callerIndexBalanceBefore).to.equal(utils.scaleDecimals(maxDeposit, assetParams2.decimals, 18n))
        })

        it("should apply an equalization bounty if one is set", async function() {
          const { 
            reserveManager,
            mintable2, 
            admin, 
            assetParamsNoMintable2, 
            assetParams0, 
            assetParams1, 
            assetParams2,
            poolMathWrapper,
            indexToken
          } = await loadFixture(deployAll)
          //remove mintable2 from the pool and equalize
          await reserveManager.setTargetAssetParams(assetParamsNoMintable2)
          await reserveManager.equalizeToTarget()
          //mint tokens and then add mintable2 back to the pool
          await reserveManager.mint(utils.scale10Pow18(1_000_000n), "0x")
          await reserveManager.setTargetAssetParams([assetParams0, assetParams1, assetParams2])
          const bounty = utils.scale10Pow18(1_000n)
          await indexToken.transfer(reserveManager, bounty)
          await reserveManager.increaseEqualizationBounty(bounty)
          //mintable2 is now targetted at 0.33
          const maxDeltaScaled = await poolMathWrapper.calcMaxIndividualDelta(assetParams2.targetAllocation, 0n, await reserveManager.getTotalReservesScaled())
          const maxDeposit = utils.scaleDecimals(maxDeltaScaled, 18n, assetParams2.decimals)
          const indexTokenBalanceBefore = await indexToken.balanceOf(admin.address)
          await expect(reserveManager.swapTowardsTarget(
            mintable2.target,
            maxDeposit
          )).not.to.be.reverted
          const indexTokenBalanceAfter = await indexToken.balanceOf(admin.address)
          const indexTokensReceived = indexTokenBalanceAfter - indexTokenBalanceBefore
          const expectedReceived = utils.scaleDecimals(maxDeposit, assetParams2.decimals, 18n) + bounty
          expect(indexTokensReceived).to.be.closeTo(expectedReceived, expectedReceived / 1_000_000_000_000n) //within 1 trillionth
        })
      })
    })

    describe("swap token above standard decimal scale", function() {
      describe("Withdraw", function() {
        it("should not allow swapping if the pool is equalized", async function() {
          const { reserveManager, mintable1 } = await loadFixture(deployAll)
          await expect(
            reserveManager.swapTowardsTarget(
              mintable1.target,
              -100n
            )
          ).to.be.revertedWith("withdrawal exceeds target allocation")
          await expect(
            reserveManager.swapTowardsTarget(
              mintable1.target,
              100n
            )
          ).to.be.revertedWith("deposit exceeds target allocation")
        })

        it("should not allow swapping that increases discrepency", async function() {
          const { reserveManager, mintable1, assetParamsNoMintable1, admin } = await loadFixture(deployAll)
          await reserveManager.mint(utils.scale10Pow18(1_000_000n), "0x")
          await reserveManager.setTargetAssetParams(assetParamsNoMintable1)
          //mintable1 is now targetted at 0
          await expect(
            reserveManager.swapTowardsTarget(
              mintable1.target,
              -100n
            )
          ).not.to.be.reverted
          await expect(
            reserveManager.swapTowardsTarget(
              mintable1.target,
              100n
            )
          ).to.be.revertedWith("deposit exceeds target allocation")
        })

        it("should not allow swapping that passes the target allocation", async function() {
          const { reserveManager, mintable1, assetParamsNoMintable1, admin } = await loadFixture(deployAll)
          await reserveManager.mint(utils.scale10Pow18(1_000_000n), "0x")
          await reserveManager.setTargetAssetParams(assetParamsNoMintable1)
          //mintable1 is now targetted at 0
          const maxWithdrawal = await reserveManager.getSpecificReserves(mintable1.target)
          await expect(
            reserveManager.swapTowardsTarget(
              mintable1.target,
              (maxWithdrawal * -1n) - 100n
            )
          ).to.be.revertedWith("withdrawal exceeds target allocation")
        })

        it("should swap exactly to the target", async function() {
          const { reserveManager, mintable1, assetParamsNoMintable1, admin, indexToken, assetParams1 } = await loadFixture(deployAll)
          await reserveManager.mint(utils.scale10Pow18(1_000_000n), "0x")
          await reserveManager.setTargetAssetParams(assetParamsNoMintable1)
          //mintable1 is now targetted at 0
          const callerReserveBalanceBefore = await mintable1.balanceOf(admin.address);
          const poolReserveBalanceBefore = await mintable1.balanceOf(reserveManager.target);
          const poolTotalReservesScaledBefore = await reserveManager.getTotalReservesScaled()
          const poolStorageReservesBefore = await reserveManager.getSpecificReserves(mintable1.target);
          const callerIndexBalanceBefore = await indexToken.balanceOf(admin.address);
          const maxWithdrawal = await reserveManager.getSpecificReserves(mintable1.target)
          await expect(
            reserveManager.swapTowardsTarget(
              mintable1.target,
              maxWithdrawal * -1n
            )
          ).not.to.be.reverted
          const callerReserveBalanceAfter = await mintable1.balanceOf(admin.address);
          const poolReserveBalanceAfter = await mintable1.balanceOf(reserveManager.target);
          const poolTotalReservesScaledAfter = await reserveManager.getTotalReservesScaled()
          const poolStorageReservesAfter = await reserveManager.getSpecificReserves(mintable1.target);
          const callerIndexBalanceAfter = await indexToken.balanceOf(admin.address);
          expect(callerReserveBalanceAfter - callerReserveBalanceBefore).to.equal(maxWithdrawal)
          expect(poolReserveBalanceBefore - poolReserveBalanceAfter).to.equal(maxWithdrawal)
          expect(poolTotalReservesScaledBefore - poolTotalReservesScaledAfter).to.equal(utils.scaleDecimals(maxWithdrawal, assetParams1.decimals, 18n))
          expect(poolStorageReservesBefore - poolStorageReservesAfter).to.equal(maxWithdrawal)
          expect(callerIndexBalanceBefore - callerIndexBalanceAfter).to.equal(utils.scaleDecimals(maxWithdrawal, assetParams1.decimals, 18n))
        })

        it("should apply an equalization bounty if one is set", async function() {
          const { reserveManager, mintable1, assetParamsNoMintable1, admin, indexToken, assetParams1 } = await loadFixture(deployAll)
          await reserveManager.mint(utils.scale10Pow18(1_000_000n), "0x")
          await reserveManager.setTargetAssetParams(assetParamsNoMintable1)
          const bounty = utils.scale10Pow18(1_000n)
          await indexToken.transfer(reserveManager, bounty)
          await reserveManager.increaseEqualizationBounty(bounty)
          const maxWithdrawal = await reserveManager.getSpecificReserves(mintable1.target)
          const indexTokenBalanceBefore = await indexToken.balanceOf(admin.address)
          await expect(reserveManager.swapTowardsTarget(
            mintable1.target,
            maxWithdrawal * -1n
          )).not.to.be.reverted
          const indexTokenBalanceAfter = await indexToken.balanceOf(admin.address)
          const indexTokensPaid = indexTokenBalanceBefore - indexTokenBalanceAfter
          const expectedTokensPaid = utils.scaleDecimals(maxWithdrawal, assetParams1.decimals, 18n) - bounty
          expect(indexTokensPaid).to.be.closeTo(expectedTokensPaid, expectedTokensPaid / 1_000_000_000_000n)
        })

        it("should set the bounty exactly to the burn amount if it is greater than the burn amount", async function() {
          const { reserveManager, mintable1, assetParamsNoMintable1, admin, indexToken } = await loadFixture(deployAll)
          await reserveManager.mint(utils.scale10Pow18(1_000_000n), "0x")
          await reserveManager.setTargetAssetParams(assetParamsNoMintable1)
          const bounty = utils.scale10Pow18(1_000_000n)
          await indexToken.burn(bounty)
          await reserveManager.increaseEqualizationBounty(bounty)
          const maxWithdrawal = await reserveManager.getSpecificReserves(mintable1.target)
          const indexTokenBalanceBefore = await indexToken.balanceOf(admin.address)
          await expect(reserveManager.swapTowardsTarget(
            mintable1.target,
            maxWithdrawal * -1n
          )).not.to.be.reverted
          const indexTokenBalanceAfter = await indexToken.balanceOf(admin.address)
          const indexTokensPaid = indexTokenBalanceBefore - indexTokenBalanceAfter
          expect(indexTokensPaid).to.equal(0n)
        })
      })

      describe("Deposit", function() {
        it("should not allow swapping that increases discrepency", async function() {
          const { 
            reserveManager,
            mintable1, 
            admin, 
            assetParamsNoMintable1, 
            assetParams0, 
            assetParams1, 
            assetParams2 
          } = await loadFixture(deployAll)
          //remove mintable1 from the pool and equalize
          await reserveManager.setTargetAssetParams(assetParamsNoMintable1)
          await reserveManager.equalizeToTarget()
          //mint tokens and then add mintable1 back to the pool
          await reserveManager.mint(utils.scale10Pow18(1_000_000n), "0x")
          await reserveManager.setTargetAssetParams([assetParams0, assetParams1, assetParams2])
          //mintable1 is now targetted at 0.33
          await expect(
            reserveManager.swapTowardsTarget(
              mintable1.target,
              -1n
            )
          ).to.be.revertedWith("withdrawal exceeds target allocation")
          await expect(
            reserveManager.swapTowardsTarget(
              mintable1.target,
              1n
            )
          ).not.to.be.reverted
        })

        it("should not allow swapping that passes the target allocation", async function() {
          const { 
            reserveManager,
            mintable1, 
            admin, 
            assetParamsNoMintable1, 
            assetParams0, 
            assetParams1, 
            assetParams2,
            poolMathWrapper
          } = await loadFixture(deployAll)
          //remove mintable1 from the pool and equalize
          await reserveManager.setTargetAssetParams(assetParamsNoMintable1)
          await reserveManager.equalizeToTarget()
          //mint tokens and then add mintable1 back to the pool
          await reserveManager.mint(utils.scale10Pow18(1_000_000n), "0x")
          await reserveManager.setTargetAssetParams([assetParams0, assetParams1, assetParams2])
          //mintable1 is now targetted at 0.33
          const maxDeltaScaled = await poolMathWrapper.calcMaxIndividualDelta(assetParams1.targetAllocation, 0n, await reserveManager.getTotalReservesScaled())
          await expect(
            reserveManager.swapTowardsTarget(
              mintable1.target,
              utils.scaleDecimals(maxDeltaScaled, 18n, assetParams1.decimals) + 100n
            )
          ).to.be.revertedWith("deposit exceeds target allocation")
        })

        it("should not allow a deposit that exceeds the max reserves limit", async function() {
          const { 
            reserveManager,
            mintable1, 
            maintainer, 
            assetParamsNoMintable1, 
            assetParams0, 
            assetParams1, 
            assetParams2,
            poolMathWrapper
          } = await loadFixture(deployAll)
          //remove mintable1 from the pool and equalize
          await reserveManager.setTargetAssetParams(assetParamsNoMintable1)
          await reserveManager.equalizeToTarget()
          //mint tokens and then add mintable1 back to the pool
          await reserveManager.mint(utils.scale10Pow18(1_000_000n), "0x")
          await reserveManager.setTargetAssetParams([assetParams0, assetParams1, assetParams2])
          //mintable1 is now targetted at 0.33
          await reserveManager.connect(maintainer).setMaxReserves(utils.scale10Pow18(900_000n))
          const maxDeltaScaled = await poolMathWrapper.calcMaxIndividualDelta(assetParams2.targetAllocation, 0n, await reserveManager.getTotalReservesScaled())
          await expect(
            reserveManager.swapTowardsTarget(
              mintable1.target,
              utils.scaleDecimals(maxDeltaScaled, 18n, assetParams2.decimals)
            )
          ).to.be.revertedWith("max reserves limit")
        })

        it("should swap exactly to the target", async function() {
          const { 
            reserveManager,
            mintable1, 
            admin, 
            assetParamsNoMintable1, 
            assetParams0, 
            assetParams1, 
            assetParams2,
            poolMathWrapper,
            indexToken
          } = await loadFixture(deployAll)
          //remove mintable1 from the pool and equalize
          await reserveManager.setTargetAssetParams(assetParamsNoMintable1)
          await reserveManager.equalizeToTarget()
          //mint tokens and then add mintable1 back to the pool
          await reserveManager.mint(utils.scale10Pow18(1_000_000n), "0x")
          await reserveManager.setTargetAssetParams([assetParams0, assetParams1, assetParams2])
          //mintable1 is now targetted at 0.33
          const callerReserveBalanceBefore = await mintable1.balanceOf(admin.address);
          const poolReserveBalanceBefore = await mintable1.balanceOf(reserveManager.target);
          const poolTotalReservesScaledBefore = await reserveManager.getTotalReservesScaled()
          const poolStorageReservesBefore = await reserveManager.getSpecificReserves(mintable1.target);
          const callerIndexBalanceBefore = await indexToken.balanceOf(admin.address);
          const maxDeltaScaled = await poolMathWrapper.calcMaxIndividualDelta(assetParams1.targetAllocation, 0n, await reserveManager.getTotalReservesScaled())
          const maxDeposit = utils.scaleDecimals(maxDeltaScaled, 18n, assetParams1.decimals)
          await expect(
            reserveManager.swapTowardsTarget(
              mintable1.target,
              maxDeposit
            )
          ).not.to.be.reverted
          const callerReserveBalanceAfter = await mintable1.balanceOf(admin.address);
          const poolReserveBalanceAfter = await mintable1.balanceOf(reserveManager.target);
          const poolTotalReservesScaledAfter = await reserveManager.getTotalReservesScaled()
          const poolStorageReservesAfter = await reserveManager.getSpecificReserves(mintable1.target);
          const callerIndexBalanceAfter = await indexToken.balanceOf(admin.address);
          expect(callerReserveBalanceBefore - callerReserveBalanceAfter).to.equal(maxDeposit - (maxDeposit % 100n))
          expect(poolReserveBalanceAfter - poolReserveBalanceBefore).to.equal(maxDeposit- (maxDeposit % 100n))
          expect(poolTotalReservesScaledAfter - poolTotalReservesScaledBefore).to.equal(utils.scaleDecimals(maxDeposit, assetParams1.decimals, 18n) - (maxDeposit % 100n))
          expect(poolStorageReservesAfter - poolStorageReservesBefore).to.equal(maxDeposit - (maxDeposit % 100n))
          expect(callerIndexBalanceAfter - callerIndexBalanceBefore).to.equal(utils.scaleDecimals(maxDeposit, assetParams1.decimals, 18n) - (maxDeposit % 100n))
        })

        it("should apply an equalization bounty if one is set", async function() {
          const { 
            reserveManager,
            mintable1, 
            admin, 
            assetParamsNoMintable1, 
            assetParams0, 
            assetParams1, 
            assetParams2,
            poolMathWrapper,
            indexToken
          } = await loadFixture(deployAll)
          //remove mintable1 from the pool and equalize
          await reserveManager.setTargetAssetParams(assetParamsNoMintable1)
          await reserveManager.equalizeToTarget()
          //mint tokens and then add mintable1 back to the pool
          await reserveManager.mint(utils.scale10Pow18(1_000_000n), "0x")
          await reserveManager.setTargetAssetParams([assetParams0, assetParams1, assetParams2])
          const bounty = utils.scale10Pow18(1_000n)
          await indexToken.transfer(reserveManager, bounty)
          await reserveManager.increaseEqualizationBounty(bounty)
          //mintable1 is now targetted at 0.33
          const maxDeltaScaled = await poolMathWrapper.calcMaxIndividualDelta(assetParams1.targetAllocation, 0n, await reserveManager.getTotalReservesScaled())
          const maxDeposit = utils.scaleDecimals(maxDeltaScaled, 18n, assetParams1.decimals)
          const indexTokenBalanceBefore = await indexToken.balanceOf(admin.address)
          await expect(reserveManager.swapTowardsTarget(
            mintable1.target,
            maxDeposit
          )).not.to.be.reverted
          const indexTokenBalanceAfter = await indexToken.balanceOf(admin.address)
          const indexTokensReceived = indexTokenBalanceAfter - indexTokenBalanceBefore
          const expectedReceived = utils.scaleDecimals(maxDeposit, assetParams1.decimals, 18n) + bounty
          expect(indexTokensReceived).to.be.closeTo(expectedReceived, expectedReceived / 1_000_000_000_000n) //within 1 trillionth
        })
      })
    })
  })

  describe("equalizeToTarget", function() {
    it("equalizes the pool", async function() {
      const { reserveManager, assetParamsNoMintable0, admin, mintable0, mintable1, mintable2 } = await loadFixture(deployAll)
      await reserveManager.mint(utils.scale10Pow18(1_000n), "0x")
      await reserveManager.setTargetAssetParams(assetParamsNoMintable0)
      expect(await reserveManager.getIsEqualized()).to.equal(false)
      await reserveManager.equalizeToTarget()
      expect(await reserveManager.getIsEqualized()).to.equal(true)
    })

    it("removes zero allocation assets from assetParams_ map and currentAssetParams_ list", async function() {
      const { reserveManager, assetParamsNoMintable0, admin, mintable0 } = await loadFixture(deployAll)
      await reserveManager.mint(utils.scale10Pow18(1_000n), "0x")
      await reserveManager.setTargetAssetParams(assetParamsNoMintable0)
      await reserveManager.equalizeToTarget()
      const mintable0ParamsEntryAfter = await reserveManager.getAssetParams(mintable0.target)
      const currentAssetParamsListAfter = await reserveManager.getCurrentAssetParams()
      currentAssetParamsListAfter.forEach((params, i) => {
        expect(params.assetAddress).not.to.equal(mintable0.target, `mintable0 still here at index ${i}`)
      })
      expect(mintable0ParamsEntryAfter.assetAddress).to.equal('0x0000000000000000000000000000000000000000')
      expect(mintable0ParamsEntryAfter.targetAllocation).to.equal(0n)
      expect(mintable0ParamsEntryAfter.decimals).to.equal(0n)
    })

    it("applies reserves tracking and token transfers correctly", async function() {
      const { reserveManager, assetParamsNoMintable0, admin, mintable0, mintable1, mintable2, assetParams0, assetParams1, assetParams2 } = await loadFixture(deployAll)
      await reserveManager.mint(utils.scale10Pow18(1_000n), "0x")
      await reserveManager.setTargetAssetParams(assetParamsNoMintable0)
      const equalizationVectorScaled = await reserveManager.getEqualizationVectorScaled()
      const callerBalance0Before = await mintable0.balanceOf(admin.address)
      const callerBalance1Before = await mintable1.balanceOf(admin.address)
      const callerBalance2Before = await mintable2.balanceOf(admin.address)
      const poolBalance0Before = await mintable0.balanceOf(reserveManager.target)
      const poolBalance1Before = await mintable1.balanceOf(reserveManager.target)
      const poolBalance2Before = await mintable2.balanceOf(reserveManager.target)
      await reserveManager.equalizeToTarget()
      const callerBalance0After = await mintable0.balanceOf(admin.address)
      const callerBalance1After = await mintable1.balanceOf(admin.address)
      const callerBalance2After = await mintable2.balanceOf(admin.address)
      const poolBalance0After = await mintable0.balanceOf(reserveManager.target)
      const poolBalance1After = await mintable1.balanceOf(reserveManager.target)
      const poolBalance2After = await mintable2.balanceOf(reserveManager.target)
      expect(poolBalance0After).to.equal(poolBalance0Before + utils.scaleDecimals(equalizationVectorScaled[0], 18n, assetParams0.decimals))
      expect(poolBalance1After).to.equal(poolBalance1Before + utils.scaleDecimals(equalizationVectorScaled[1], 18n, assetParams1.decimals))
      expect(poolBalance2After).to.equal(poolBalance2Before + utils.scaleDecimals(equalizationVectorScaled[2], 18n, assetParams2.decimals))
      expect(callerBalance0After).to.equal(callerBalance0Before - utils.scaleDecimals(equalizationVectorScaled[0], 18n, assetParams0.decimals))
      expect(callerBalance1After).to.equal(callerBalance1Before - utils.scaleDecimals(equalizationVectorScaled[1], 18n, assetParams1.decimals))
      expect(callerBalance2After).to.equal(callerBalance2Before - utils.scaleDecimals(equalizationVectorScaled[2], 18n, assetParams2.decimals))
      const specificReserves0Scaled = await reserveManager.getSpecificReservesScaled(mintable0.target)
      const specificReserves1Scaled = await reserveManager.getSpecificReservesScaled(mintable1.target)
      const specificReserves2Scaled = await reserveManager.getSpecificReservesScaled(mintable2.target)
      const totalReservesScaled = await reserveManager.getTotalReservesScaled()
      const allocation0 = Number(specificReserves0Scaled) / Number(totalReservesScaled)
      const allocation1 = Number(specificReserves1Scaled) / Number(totalReservesScaled)
      const allocation2 = Number(specificReserves2Scaled) / Number(totalReservesScaled)
      expect(allocation0).to.equal(0)
      expect(allocation1).to.equal(0.5)
      expect(allocation2).to.equal(0.5)
    })

    it("distributes the entire equalization bounty to the caller", async function() {
      const { reserveManager, assetParamsNoMintable0, admin, indexToken } = await loadFixture(deployAll)
      await reserveManager.mint(utils.scale10Pow18(1_000n), "0x")
      await reserveManager.setTargetAssetParams(assetParamsNoMintable0)
      const bounty = utils.scale10Pow18(100n)
      await indexToken.burn(bounty)
      await reserveManager.increaseEqualizationBounty(bounty)
      const callerIndexReservesBefore = await indexToken.balanceOf(admin.address)
      await reserveManager.equalizeToTarget()
      const bountyRemainingAfter = await reserveManager.getEqualizationBounty()
      const callerIndexReservesAfter = await indexToken.balanceOf(admin.address)
      expect(callerIndexReservesAfter - callerIndexReservesBefore).to.equal(bounty)
      expect(bountyRemainingAfter).to.equal(bounty)
    })
  })

  describe("withdrawAll", function() {
    it("should be able to withdraw all reserves", async function() {
      const { reserveManager, reserveManager0, indexToken, admin, mintable0, mintable1, mintable2, assetParams0, assetParams1, assetParams2, minbalanceDivisorChangeDelay, maxbalanceDivisorChangePerSecondQ96 } = await loadFixture(deployAll);
      await reserveManager.mint(utils.scale10Pow18(42069n), "0x")
      await reserveManager.startEmigration(
        reserveManager0,
        minbalanceDivisorChangeDelay,
        maxbalanceDivisorChangePerSecondQ96
      )
      await reserveManager0.mint(await reserveManager.getTotalReservesScaled(), "0x")
      await reserveManager.withdrawAll()
      expect(await reserveManager.getTotalReservesScaled()).to.equal(0n)
      expect(await reserveManager.getSpecificReservesScaled(mintable0)).to.equal(0n)
      expect(await reserveManager.getSpecificReservesScaled(mintable1)).to.equal(0n)
      expect(await reserveManager.getSpecificReservesScaled(mintable2)).to.equal(0n)
      expect(await reserveManager.getSpecificReserves(mintable0)).to.equal(0n)
      expect(await reserveManager.getSpecificReserves(mintable1)).to.equal(0n)
      expect(await reserveManager.getSpecificReserves(mintable2)).to.equal(0n)
    })

    it("should not be callable if the pool is not emigrating", async function() {
      const { reserveManager, reserveManager0, indexToken, admin, mintable0, mintable1, mintable2, assetParams0, assetParams1, assetParams2, minbalanceDivisorChangeDelay, maxbalanceDivisorChangePerSecondQ96 } = await loadFixture(deployAll);
      await expect(reserveManager.withdrawAll()).to.be.revertedWith("pool is not emigrating")
    })
  })
});
