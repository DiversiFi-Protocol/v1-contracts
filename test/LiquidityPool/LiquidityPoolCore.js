const {
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const deployAll = require("./deployAll.js");
const hre = require("hardhat");
const { getAddress, parseGwei, getCreateAddress, maxUint16 } = require("ethers");
const utils = require("../testModules/utils.js");
const { expect } = require("chai")
const { assetParams0, assetParams1, assetParams2 } = require("../../deployments/assetParams.js");

const ONE_BILLION = 1_000_000_000n
const DECIMAL_SCALE = 18n
describe("LiquidityPool", function() {
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

  describe("Direct mint/burn functions", async function() {
    describe("mint", async function() {
      it("basic intended usage", async function() {
        const { liquidityPool, liquidityToken, admin, mintable0, mintable1, mintable2 } = await loadFixture(deployAll);
        const mintAmount = utils.scale10Pow18(3000n)
        const prevBal0 = await mintable0.balanceOf(admin.address)
        const prevBal1 = await mintable1.balanceOf(admin.address)
        const prevBal2 = await mintable2.balanceOf(admin.address)
        const prevLiquidityBal = await liquidityToken.balanceOf(admin.address)

        await liquidityPool.mint(mintAmount, admin.address)

        const balance0 = await mintable0.balanceOf(admin.address)
        const balance1 = await mintable1.balanceOf(admin.address) 
        const balance2 = await mintable2.balanceOf(admin.address) 
        const liquidityBal = await liquidityToken.balanceOf(admin.address)

        const payAmount0 = prevBal0 - balance0
        const payAmount1 = prevBal1 - balance1
        const payAmount2 = prevBal2 - balance2
        const mintedAmount = liquidityBal - prevLiquidityBal

        const targetReserves0 = mintAmount * utils.scaleAllocation(assetParams0.targetAllocation) >> utils.SHIFT
        const targetReserves1 = mintAmount * utils.scaleAllocation(assetParams1.targetAllocation) >> utils.SHIFT
        const targetReserves2 = mintAmount * utils.scaleAllocation(assetParams2.targetAllocation) >> utils.SHIFT

        const scaledReserves0 = await liquidityPool.getSpecificScaledReserves(mintable0.target)
        const scaledReserves1 = await liquidityPool.getSpecificScaledReserves(mintable1.target)
        const scaledReserves2 = await liquidityPool.getSpecificScaledReserves(mintable2.target)

        expect(scaledReserves0).to.be.closeTo(targetReserves0, targetReserves0 / ONE_BILLION)
        expect(scaledReserves1).to.be.closeTo(targetReserves1, targetReserves0 / ONE_BILLION)
        expect(scaledReserves2).to.be.closeTo(targetReserves2, targetReserves0 / ONE_BILLION)
        expect(mintedAmount).to.equal(mintAmount)

        //expect the amounts paid to equal the scaled reserves with the correct decimal adjustment
        const adjustedPayAmount0 = utils.scaleDecimals(payAmount0, assetParams0.decimals, DECIMAL_SCALE)
        const adjustedPayAmount1 = utils.scaleDecimals(payAmount1, assetParams1.decimals, DECIMAL_SCALE)
        const adjustedPayAmount2 = utils.scaleDecimals(payAmount2, assetParams2.decimals, DECIMAL_SCALE)
        
        expect(scaledReserves0).to.equal(adjustedPayAmount0)
        expect(scaledReserves1).to.equal(adjustedPayAmount1)
        expect(scaledReserves2).to.equal(adjustedPayAmount2)
      });

      it("usage with mint fee", async function() {
        const { liquidityPool, liquidityToken, admin, mintable0, mintable1, mintable2 } = await loadFixture(deployAll);
        const mintAmount = utils.scale10Pow18(3000n)
        const prevBal0 = await mintable0.balanceOf(admin.address)
        const prevBal1 = await mintable1.balanceOf(admin.address)
        const prevBal2 = await mintable2.balanceOf(admin.address)
        
        //get prev balances of the pool
        const prevBalPool0 = await mintable0.balanceOf(liquidityPool.target)
        const prevBalPool1 = await mintable1.balanceOf(liquidityPool.target)
        const prevBalPool2 = await mintable2.balanceOf(liquidityPool.target)


        const prevLiquidityBal = await liquidityToken.balanceOf(admin.address)
        const fee = 0.01

        await liquidityPool.setMintFee(utils.decimalToFixed(fee))

        await liquidityPool.mint(mintAmount, admin.address)

        const balance0 = await mintable0.balanceOf(admin.address)
        const balance1 = await mintable1.balanceOf(admin.address) 
        const balance2 = await mintable2.balanceOf(admin.address) 
        const liquidityBal = await liquidityToken.balanceOf(admin.address)

        //get balances of the pool
        const balPool0 = await mintable0.balanceOf(liquidityPool.target)
        const balPool1 = await mintable1.balanceOf(liquidityPool.target)
        const balPool2 = await mintable2.balanceOf(liquidityPool.target)

        //compute the actual amounts paid into the pool
        const poolPayAmount0 = prevBalPool0 - balPool0
        const poolPayAmount1 = prevBalPool1 - balPool1
        const poolPayAmount2 = prevBalPool2 - balPool2

        const mintedAmount = liquidityBal - prevLiquidityBal
        const feesCollected = await liquidityPool.getFeesCollected()
        const expectedFeesCollected = ((mintAmount+feesCollected) * utils.decimalToFixed(fee)) >> utils.SHIFT

        expect(feesCollected).to.equal(expectedFeesCollected)
        expect(Number(feesCollected) / Number(mintedAmount + feesCollected)).to.equal(fee)
        expect(mintedAmount).to.equal(mintAmount)
      })

      it("should fail when disabled", async function() {
        const { liquidityPool, liquidityToken, admin, mintable0, mintable1, mintable2 } = await loadFixture(deployAll);
        await liquidityPool.setIsDirectMintEnabled(false)
        await expect(
          liquidityPool.mint(utils.scale10Pow18(3000n), admin.address)
        ).to.be.revertedWith("direct minting disabled")
      })
    });

    describe("burn", async function() {
      it("basic intended usage", async function() {
        const { liquidityPool, liquidityToken, admin, mintable0, mintable1, mintable2, mintable3, t0Target, t1Target, t2Target, t3Target, m0Params, m1Params, m2Params, m3Params } = await loadFixture(deployAll);
        const mintAmount = utils.scale10Pow18(1000n)
        const prevBal0 = await mintable0.balanceOf(admin.address)
        const prevBal1 = await mintable1.balanceOf(admin.address)
        const prevBal2 = await mintable2.balanceOf(admin.address)
        const prevLiquidityBal = await liquidityToken.balanceOf(admin.address)

        await liquidityPool.mint(mintAmount)

        const preBurnBalance0 = await mintable0.balanceOf(admin.address)
        const preBurnBalance1 = await mintable1.balanceOf(admin.address)
        const preBurnBalance2 = await mintable2.balanceOf(admin.address)
        const liquidityBalPreBurn = await liquidityToken.balanceOf(admin.address)

        const payAmount0 = prevBal0 - preBurnBalance0
        const payAmount1 = prevBal1 - preBurnBalance1
        const payAmount2 = prevBal2 - preBurnBalance2
        const payAmount3 = prevBal3 - preBurnBalance3
        const mintedAmount = liquidityBalPreBurn - prevLiquidityBal

        await liquidityPool.burn(liquidityBalPreBurn)

        const balance0 = await mintable0.balanceOf(admin.address)
        const balance1 = await mintable1.balanceOf(admin.address) 
        const balance2 = await mintable2.balanceOf(admin.address) 
        const balance3 = await mintable3.balanceOf(admin.address) 
        const liquidityBal = await liquidityToken.balanceOf(admin.address)

        const claimAmount0 = balance0 - preBurnBalance0
        const claimAmount1 = balance1 - preBurnBalance1
        const claimAmount2 = balance2 - preBurnBalance2
        const claimAmount3 = balance3 - preBurnBalance3
        const burnedAmount = liquidityBalPreBurn - liquidityBal

        //all balances should be the same as previous balances after burning
        expect(utils.closeToBigPct(claimAmount0, payAmount0, utils.ONE_MILLIONTH_STRING)).to.equal(true)
        expect(utils.closeToBigPct(claimAmount1, payAmount1, utils.ONE_MILLIONTH_STRING)).to.equal(true)
        expect(utils.closeToBigPct(claimAmount2, payAmount2, utils.ONE_MILLIONTH_STRING)).to.equal(true)
        expect(utils.closeToBigPct(claimAmount3, payAmount3, utils.ONE_MILLIONTH_STRING)).to.equal(true)
        expect(utils.closeToBigPct(burnedAmount, mintedAmount, utils.ONE_MILLIONTH_STRING)).to.equal(true)
      });

      it("should not be usable above max allocation", async function() {
        const { liquidityPool, bootstrapLiqThreshold, liquidityToken, admin, mintable0, mintable1, mintable2, mintable3, t0Target, t1Target, t2Target, t3Target } = await loadFixture(deployAll);
        liquidityPool.mint(utils.scale10Pow18(bootstrapLiqThreshold))
        await expect(
          liquidityPool.mint(utils.scale10Pow18(bootstrapLiqThreshold+1n))
        ).to.be.revertedWith("Reserves above redeem threshold")
      })

      it("should adjust the reserves properly", async function() {
        const { liquidityPool, bootstrapLiqThreshold, liquidityToken, admin, mintable0, mintable1, mintable2, mintable3, t0Target, t1Target, t2Target, t3Target, m0Params, m1Params, m2Params, m3Params } = await loadFixture(deployAll);
        await liquidityPool.mint(utils.scale10Pow18(bootstrapLiqThreshold))
        const mintedAmount = liquidityToken.balanceOf(admin.address)
        await liquidityPool.burn(mintedAmount)
        const m0Reserves = await liquidityPool.getAdjustedReserves(mintable0.target)
        const m1Reserves = await liquidityPool.getAdjustedReserves(mintable1.target)
        const m2Reserves = await liquidityPool.getAdjustedReserves(mintable2.target)
        const m3Reserves = await liquidityPool.getAdjustedReserves(mintable3.target)
        const totalAdjustedReserves = await liquidityPool.getTotalAdjustedReserves()

        const poolBalance0 = await mintable0.balanceOf(liquidityPool.target)
        const poolBalance1 = await mintable1.balanceOf(liquidityPool.target) 
        const poolBalance2 = await mintable2.balanceOf(liquidityPool.target) 
        const poolBalance3 = await mintable3.balanceOf(liquidityPool.target) 

        expect(m0Reserves).to.equal(poolBalance0 * 10n ** (18n - m0Params.decimals))
        expect(m1Reserves).to.equal(poolBalance1 * 10n ** (18n - m1Params.decimals))
        expect(m2Reserves).to.equal(poolBalance2 * 10n ** (18n - m2Params.decimals))
        expect(m3Reserves).to.equal(poolBalance3 * 10n ** (18n - m3Params.decimals))

        expect(totalAdjustedReserves).to.equal(m0Reserves+m1Reserves+m2Reserves+m3Reserves);
      })
    });  
  });
});
