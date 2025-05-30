const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const utils = require("../testModules/utils.js");
const deployAll = require("./deployAll.js");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("LiquidityPool - Mint/Burn Functions", function () {
  describe("mint", function () {
    it("mints liquidity tokens and updates reserves as expected", async function () {
      const { liquidityPool, indexToken, admin, mintable0, mintable1, mintable2, assetParams0, assetParams1, assetParams2 } = await loadFixture(deployAll);
      const mintAmount = utils.scale10Pow18(3000n);
      const prevBal0 = await mintable0.balanceOf(admin.address);
      const prevBal1 = await mintable1.balanceOf(admin.address);
      const prevBal2 = await mintable2.balanceOf(admin.address);
      const prevLiquidityBal = await indexToken.balanceOf(admin.address);

      await expect(
        liquidityPool.connect(admin).mint(mintAmount, admin.address)
      ).to.emit(liquidityPool, "Mint");

      const balance0 = await mintable0.balanceOf(admin.address);
      const balance1 = await mintable1.balanceOf(admin.address);
      const balance2 = await mintable2.balanceOf(admin.address);
      const liquidityBal = await indexToken.balanceOf(admin.address);

      // Check that liquidity tokens were minted
      expect(liquidityBal - prevLiquidityBal).to.equal(mintAmount);
      // Check that reserves were deducted from admin
      expect(balance0).to.be.below(prevBal0);
      expect(balance1).to.be.below(prevBal1);
      expect(balance2).to.be.below(prevBal2);
      // Check that pool reserves increased
      const scaledReserves0 = await liquidityPool.getSpecificReservesScaled(mintable0.target);
      const scaledReserves1 = await liquidityPool.getSpecificReservesScaled(mintable1.target);
      const scaledReserves2 = await liquidityPool.getSpecificReservesScaled(mintable2.target);
      expect(scaledReserves0).to.be.above(0);
      expect(scaledReserves1).to.be.above(0);
      expect(scaledReserves2).to.be.above(0);
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
      console.log("nextMaxReserves", nextMaxReserves)
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
});
