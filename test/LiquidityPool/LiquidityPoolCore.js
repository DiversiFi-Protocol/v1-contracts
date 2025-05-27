const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const utils = require("../testModules/utils.js");
const deployAll = require("./deployAll.js");

describe("LiquidityPool - Mint/Burn Functions", function () {
  describe("mint", function () {
    it("mints liquidity tokens and updates reserves as expected", async function () {
      const { liquidityPool, liquidityToken, admin, mintable0, mintable1, mintable2, assetParams0, assetParams1, assetParams2 } = await loadFixture(deployAll);
      const mintAmount = utils.scale10Pow18(3000n);
      const prevBal0 = await mintable0.balanceOf(admin.address);
      const prevBal1 = await mintable1.balanceOf(admin.address);
      const prevBal2 = await mintable2.balanceOf(admin.address);
      const prevLiquidityBal = await liquidityToken.balanceOf(admin.address);

      await expect(
        liquidityPool.connect(admin).mint(mintAmount, admin.address)
      ).to.emit(liquidityPool, "Mint");

      const balance0 = await mintable0.balanceOf(admin.address);
      const balance1 = await mintable1.balanceOf(admin.address);
      const balance2 = await mintable2.balanceOf(admin.address);
      const liquidityBal = await liquidityToken.balanceOf(admin.address);

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

    it("succeeds when minting exactly up to the maxReserves limit", async function () {
      const { liquidityPool, admin } = await loadFixture(deployAll);
      // Set a low maxReserves limit
      const lowLimit = utils.scale10Pow18(1000n);
      await liquidityPool.connect(admin).setMaxReserves(lowLimit);
      // Mint up to the limit
      await expect(
        liquidityPool.connect(admin).mint(lowLimit, admin.address)
      ).to.not.be.reverted;
      // The total reserves should now equal the limit
      const totalReserves = await liquidityPool.getTotalReservesScaled();
      expect(totalReserves).to.equal(lowLimit);
    });

    it("reverts when minting above the maxReserves limit (with cooldown active)", async function () {
      const { liquidityPool, admin } = await loadFixture(deployAll);
      // Set a low maxReserves limit
      const lowLimit = utils.scale10Pow18(1000n);
      await liquidityPool.connect(admin).setMaxReserves(lowLimit);
      // Mint up to the limit (fills the pool)
      await liquidityPool.connect(admin).mint(lowLimit, admin.address);
      // Now try to mint 1 more (should revert due to cooldown)
      await expect(
        liquidityPool.connect(admin).mint(1n, admin.address)
      ).to.be.revertedWith("max reserves limit");
    });
  });

  describe("burn", function () {
    it("burns liquidity tokens and returns assets as expected", async function () {
      const { liquidityPool, liquidityToken, admin, mintable0, mintable1, mintable2 } = await loadFixture(deployAll);
      const mintAmount = utils.scale10Pow18(1000n);
      await liquidityPool.connect(admin).mint(mintAmount, admin.address);
      const prevBal0 = await mintable0.balanceOf(admin.address);
      const prevBal1 = await mintable1.balanceOf(admin.address);
      const prevBal2 = await mintable2.balanceOf(admin.address);
      const prevLiquidityBal = await liquidityToken.balanceOf(admin.address);

      await liquidityToken.connect(admin).approve(liquidityPool.target, mintAmount);
      await expect(
        liquidityPool.connect(admin).burn(mintAmount)
      ).to.emit(liquidityPool, "Burn");

      const balance0 = await mintable0.balanceOf(admin.address);
      const balance1 = await mintable1.balanceOf(admin.address);
      const balance2 = await mintable2.balanceOf(admin.address);
      const liquidityBal = await liquidityToken.balanceOf(admin.address);

      // Check that liquidity tokens were burned
      expect(prevLiquidityBal - liquidityBal).to.equal(mintAmount);
      // Check that assets were returned to admin
      expect(balance0).to.be.above(prevBal0);
      expect(balance1).to.be.above(prevBal1);
      expect(balance2).to.be.above(prevBal2);
    });

    it("reverts if user tries to burn more than their balance", async function () {
      const { liquidityPool, liquidityToken, admin } = await loadFixture(deployAll);
      const mintAmount = utils.scale10Pow18(1000n);
      await liquidityPool.connect(admin).mint(mintAmount, admin.address);
      await liquidityToken.connect(admin).approve(liquidityPool.target, mintAmount + 1n);
      await expect(
        liquidityPool.connect(admin).burn(mintAmount + 1n)
      ).to.be.reverted;
    });
  });
});
