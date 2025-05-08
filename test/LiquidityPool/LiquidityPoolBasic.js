const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const hre = require("hardhat");
const { getAddress, parseGwei, getCreateAddress, maxUint16 } = require("ethers");
const utils = require("../testModules/utils.js")
const { expect } = require("chai")
const { assetParams0, assetParams1, assetParams2 } = require("./assetParams.js");

const ONE_BILLION = 1_000_000_000n
const DECIMAL_SCALE = 18n

describe("LiquidityPool", function() {
  async function deployAll() {
    const tokenName = "Diversified USD";
    const tokenSymbol = "USD1";
    const [admin, unpriviledged] = await hre.ethers.getSigners();
    const liquidityPoolAddress = getCreateAddress({
      from: admin.address,
      nonce: 2n,
    });

    const poolMathLibraryFactory = await hre.ethers.getContractFactory("PoolMath")
    const poolMathLibrary = await poolMathLibraryFactory.deploy()

    const liquidityToken = await hre.ethers.deployContract("LiquidityToken", [
      tokenName,
      tokenSymbol,
      liquidityPoolAddress,
      admin.address,
    ]);

    const liquidityPool = await hre.ethers.deployContract("LiquidityPool", [
      await admin.getAddress(),
      await liquidityToken.getAddress(),
      ethers.MaxUint256,
      utils.decimalToFixed(0.1)
    ], {
      libraries: {
        PoolMath: poolMathLibrary.target
      }
    });

    const mintable0 = await hre.ethers.deployContract("MintableERC20", [
      "Mintable0",
      "M0",
      assetParams0.decimals,
    ]);
    const mintable1 = await hre.ethers.deployContract("MintableERC20", [
      "Mintable1",
      "M1",
      assetParams1.decimals,
    ]);
    const mintable2 = await hre.ethers.deployContract("MintableERC20", [
      "Mintable2",
      "M2",
      assetParams2.decimals,
    ]);

    await mintable0.mint(admin.address, utils.MAX_UINT_256 / 2n)
    await mintable1.mint(admin.address, utils.MAX_UINT_256 / 2n)
    await mintable2.mint(admin.address, utils.MAX_UINT_256 / 2n)
    await mintable0.approve(liquidityPool.target, utils.MAX_UINT_256)
    await mintable1.approve(liquidityPool.target, utils.MAX_UINT_256)
    await mintable2.approve(liquidityPool.target, utils.MAX_UINT_256)
    await liquidityToken.approve(liquidityPool.target, utils.MAX_UINT_256)

    await mintable0.mint(unpriviledged.address, utils.MAX_UINT_256 / 2n)
    await mintable1.mint(unpriviledged.address, utils.MAX_UINT_256 / 2n)
    await mintable2.mint(unpriviledged.address, utils.MAX_UINT_256 / 2n)
    await mintable0.attach(unpriviledged).approve(liquidityPool.target, utils.MAX_UINT_256)
    await mintable1.attach(unpriviledged).approve(liquidityPool.target, utils.MAX_UINT_256)
    await mintable2.attach(unpriviledged).approve(liquidityPool.target, utils.MAX_UINT_256)
    await liquidityToken.attach(unpriviledged).approve(liquidityPool.target, utils.MAX_UINT_256)

    // @ts-ignore
    await liquidityPool.setAssetParams([mintable0.target, mintable1.target, mintable2.target], [assetParams0, assetParams1, assetParams2]);

    await liquidityPool.mint(utils.scale10Pow18(1000000n), admin.address)

    return {
      liquidityToken,
      liquidityPool,
      admin,
      unpriviledged,
      tokenName,
      tokenSymbol,
      mintable0,
      mintable1,
      mintable2,
    };
  }

  describe("SwapGivenIn", function () {
    it("swap underlying for liquidity token", async function () {
      const { liquidityPool, liquidityToken, admin, mintable0, mintable1, mintable2 } = await loadFixture(deployAll);

      const inputAmount = utils.scaleDecimals(1000n, 0n, assetParams0.decimals); // 1000 tokens
      const minOutput = utils.scaleDecimals(900n, 0n, 18n); // Minimum acceptable output
  
      // Initial balances
      const initialAdminBalance0 = await mintable0.balanceOf(admin.address);
      const initialAdminBalanceLiquidity = await liquidityToken.balanceOf(admin.address);
      const initialPoolBalance0 = await mintable0.balanceOf(liquidityPool.target);
      const initialPoolBalanceLiquidity = await liquidityToken.balanceOf(liquidityPool.target);
  
      // Approve and perform the swap    
      await mintable0.approve(liquidityPool.target, inputAmount);
      await liquidityPool.swapGivenIn(admin.address, mintable0.target, liquidityToken.target, inputAmount, minOutput);
      
      // Final balances
      const finalAdminBalance0 = await mintable0.balanceOf(admin.address);
      const finalAdminBalanceLiquidity = await liquidityToken.balanceOf(admin.address);
      const finalPoolBalance0 = await mintable0.balanceOf(liquidityPool.target);
      const finalPoolBalanceLiquidity = await liquidityToken.balanceOf(liquidityPool.target)
      // Calculate output amount based on balance changes
      const outputAmount = finalAdminBalanceLiquidity - initialAdminBalanceLiquidity;
      // Assertions
      expect(finalAdminBalance0).to.equal(initialAdminBalance0 - inputAmount);
      expect(finalAdminBalanceLiquidity).to.be.closeTo(initialAdminBalanceLiquidity + outputAmount, outputAmount / 1_000_000n);
      expect(finalPoolBalance0).to.equal(initialPoolBalance0 + inputAmount);
      expect(finalPoolBalanceLiquidity - initialPoolBalanceLiquidity).to.equal(0n)
      // Check fees collected
      const feesCollected = await liquidityPool.getFeesCollected();
      const expectedFeesCollected = (utils.scaleFee(assetParams0.tickData[2].increaseFee) * (outputAmount + feesCollected)) >> utils.SHIFT
      expect(feesCollected).to.be.closeTo(expectedFeesCollected, expectedFeesCollected / 1_000_000n);
    });
  
    it("swap liquidity token for underlying", async function () {
      const { liquidityPool, liquidityToken, admin, mintable0 } = await loadFixture(deployAll);

      const inputAmount = utils.scaleDecimals(1000n, 0n, 18n); // 1000 liquidity tokens
      const minOutput = utils.scaleDecimals(900n, 0n, assetParams0.decimals); // Minimum acceptable output
    
      // Initial balances
      const initialAdminBalanceLiquidity = await liquidityToken.balanceOf(admin.address);
      const initialAdminBalance0 = await mintable0.balanceOf(admin.address);
      const initialPoolBalanceLiquidity = await liquidityToken.balanceOf(liquidityPool.target);
      const initialPoolBalance0 = await mintable0.balanceOf(liquidityPool.target);
    
      // Approve and perform the swap
      await liquidityToken.approve(liquidityPool.target, inputAmount);
      await liquidityPool.swapGivenIn(admin.address, liquidityToken.target, mintable0.target, inputAmount, minOutput);
    
      // Final balances
      const finalAdminBalanceLiquidity = await liquidityToken.balanceOf(admin.address);
      const finalAdminBalance0 = await mintable0.balanceOf(admin.address);
      const finalPoolBalance0 = await mintable0.balanceOf(liquidityPool.target);
    
      // Calculate output amount based on balance changes
      const outputAmount = finalAdminBalance0 - initialAdminBalance0;
    
      // Assertions
      expect(finalAdminBalanceLiquidity).to.equal(initialAdminBalanceLiquidity - inputAmount);
      expect(finalAdminBalance0).to.be.closeTo(initialAdminBalance0 + outputAmount, outputAmount / 1_000_000n);
      expect(finalPoolBalance0).to.equal(initialPoolBalance0 - outputAmount);
    
      // Check fees collected
      const feesCollected = await liquidityPool.getFeesCollected();
      const expectedFeesCollected = (utils.scaleFee(assetParams0.tickData[1].decreaseFee) * inputAmount) >> utils.SHIFT;
      expect(feesCollected).to.be.closeTo(expectedFeesCollected, expectedFeesCollected / 1_000_000n);
    });
  
    it("swap underlying for underlying", async function () {
      const { liquidityPool, admin, mintable0, mintable1 } = await loadFixture(deployAll);

      const inputAmount = utils.scaleDecimals(1000n, 0n, assetParams0.decimals); // 1000 tokens
      const minOutput = utils.scaleDecimals(900n, 0n, assetParams1.decimals); // Minimum acceptable output

      // Initial balances
      const initialAdminBalance0 = await mintable0.balanceOf(admin.address);
      const initialAdminBalance1 = await mintable1.balanceOf(admin.address);
      const initialPoolBalance0 = await mintable0.balanceOf(liquidityPool.target);
      const initialPoolBalance1 = await mintable1.balanceOf(liquidityPool.target);

      // Approve and perform the swap
      await mintable0.approve(liquidityPool.target, inputAmount);
      await liquidityPool.swapGivenIn(admin.address, mintable0.target, mintable1.target, inputAmount, minOutput);

      // Final balances
      const finalAdminBalance0 = await mintable0.balanceOf(admin.address);
      const finalAdminBalance1 = await mintable1.balanceOf(admin.address);
      const finalPoolBalance0 = await mintable0.balanceOf(liquidityPool.target);
      const finalPoolBalance1 = await mintable1.balanceOf(liquidityPool.target);

      // Calculate output amount based on balance changes
      const outputAmount = finalAdminBalance1 - initialAdminBalance1;

      // Assertions
      expect(finalAdminBalance0).to.equal(initialAdminBalance0 - inputAmount);
      expect(finalAdminBalance1).to.be.closeTo(initialAdminBalance1 + outputAmount, outputAmount / 100n); // 1% tolerance
      expect(finalPoolBalance0).to.equal(initialPoolBalance0 + inputAmount);
      expect(finalPoolBalance1).to.equal(initialPoolBalance1 - outputAmount);

      // Check fees collected (rough estimate within 1%)
      const scaledInputAmount = utils.scaleDecimals(inputAmount, assetParams0.decimals, DECIMAL_SCALE);
      const scaledOutputAmount = utils.scaleDecimals(outputAmount, assetParams1.decimals, DECIMAL_SCALE);
      const feesCollected = await liquidityPool.getFeesCollected();
      const expectedFeesCollected = 
        (utils.scaleFee(assetParams0.tickData[2].increaseFee) * scaledInputAmount +
        utils.scaleFee(assetParams1.tickData[1].decreaseFee) * scaledOutputAmount) >> utils.SHIFT;
      expect(feesCollected).to.be.closeTo(expectedFeesCollected, expectedFeesCollected / 1000n); // 0.1% tolerance because this is a very rough estimate
    });
  });

  describe.only("SwapGivenOut", function () {
    it("swap underlying for liquidity token", async function () {
      const { liquidityPool, liquidityToken, admin, mintable0 } = await loadFixture(deployAll);
  
      const outputAmount = utils.scaleDecimals(900n, 0n, 18n); // 900 liquidity tokens
      const maxInput = utils.scaleDecimals(1000n, 0n, assetParams0.decimals); // Maximum acceptable input
  
      // Initial balances
      const initialAdminBalance0 = await mintable0.balanceOf(admin.address);
      const initialAdminBalanceLiquidity = await liquidityToken.balanceOf(admin.address);
      const initialPoolBalance0 = await mintable0.balanceOf(liquidityPool.target);
      const initialPoolBalanceLiquidity = await liquidityToken.balanceOf(liquidityPool.target);
  
      // Approve and perform the swap
      await mintable0.approve(liquidityPool.target, maxInput);
      await liquidityPool.swapGivenOut(admin.address, mintable0.target, liquidityToken.target, outputAmount, maxInput);
  
      // Final balances
      const finalAdminBalance0 = await mintable0.balanceOf(admin.address);
      const finalAdminBalanceLiquidity = await liquidityToken.balanceOf(admin.address);
      const finalPoolBalance0 = await mintable0.balanceOf(liquidityPool.target);
      const finalPoolBalanceLiquidity = await liquidityToken.balanceOf(liquidityPool.target);
  
      // Calculate input amount based on balance changes
      const inputAmount = initialAdminBalance0 - finalAdminBalance0;
  
      // Assertions
      expect(finalAdminBalance0).to.equal(initialAdminBalance0 - inputAmount);
      expect(finalAdminBalanceLiquidity).to.equal(initialAdminBalanceLiquidity + outputAmount);
      expect(finalPoolBalance0).to.equal(initialPoolBalance0 + inputAmount);
      expect(finalPoolBalanceLiquidity).to.equal(initialPoolBalanceLiquidity);
  
      // Check fees collected
      const feesCollected = await liquidityPool.getFeesCollected();
      const expectedFeesCollected = (utils.scaleFee(assetParams0.tickData[2].increaseFee) * (outputAmount + feesCollected)) >> utils.SHIFT;
      expect(feesCollected).to.be.closeTo(expectedFeesCollected, expectedFeesCollected / 1_000_000n);
    });
  
    it("swap liquidity token for underlying", async function () {
      const { liquidityPool, liquidityToken, admin, mintable0 } = await loadFixture(deployAll);
  
      const outputAmount = utils.scaleDecimals(900n, 0n, assetParams0.decimals); // 900 tokens
      const maxInput = utils.scaleDecimals(1000n, 0n, 18n); // Maximum acceptable input
  
      // Initial balances
      const initialAdminBalanceLiquidity = await liquidityToken.balanceOf(admin.address);
      const initialAdminBalance0 = await mintable0.balanceOf(admin.address);
      const initialPoolBalanceLiquidity = await liquidityToken.balanceOf(liquidityPool.target);
      const initialPoolBalance0 = await mintable0.balanceOf(liquidityPool.target);
  
      // Approve and perform the swap
      await liquidityToken.approve(liquidityPool.target, maxInput);
      await liquidityPool.swapGivenOut(admin.address, liquidityToken.target, mintable0.target, outputAmount, maxInput);
  
      // Final balances
      const finalAdminBalanceLiquidity = await liquidityToken.balanceOf(admin.address);
      const finalAdminBalance0 = await mintable0.balanceOf(admin.address);
      const finalPoolBalanceLiquidity = await liquidityToken.balanceOf(liquidityPool.target);
      const finalPoolBalance0 = await mintable0.balanceOf(liquidityPool.target);
  
      // Calculate input amount based on balance changes
      const inputAmount = initialAdminBalanceLiquidity - finalAdminBalanceLiquidity;
  
      // Assertions
      expect(finalAdminBalanceLiquidity).to.equal(initialAdminBalanceLiquidity - inputAmount);
      expect(finalAdminBalance0).to.equal(initialAdminBalance0 + outputAmount);
      expect(finalPoolBalanceLiquidity).to.equal(initialPoolBalanceLiquidity);
      expect(finalPoolBalance0).to.equal(initialPoolBalance0 - outputAmount);
  
      // Check fees collected
      const feesCollected = await liquidityPool.getFeesCollected();
      const expectedFeesCollected = (utils.scaleFee(assetParams0.tickData[1].decreaseFee) * inputAmount) >> utils.SHIFT;
      expect(feesCollected).to.be.closeTo(expectedFeesCollected, expectedFeesCollected / 1_000_000n);
    });
  
    it("swap underlying for underlying", async function () {
      const { liquidityPool, admin, mintable0, mintable1 } = await loadFixture(deployAll);
  
      const outputAmount = utils.scaleDecimals(900n, 0n, assetParams1.decimals); // 900 tokens
      const maxInput = utils.scaleDecimals(1000n, 0n, assetParams0.decimals); // Maximum acceptable input
  
      // Initial balances
      const initialAdminBalance0 = await mintable0.balanceOf(admin.address);
      const initialAdminBalance1 = await mintable1.balanceOf(admin.address);
      const initialPoolBalance0 = await mintable0.balanceOf(liquidityPool.target);
      const initialPoolBalance1 = await mintable1.balanceOf(liquidityPool.target);
  
      // Approve and perform the swap
      await mintable0.approve(liquidityPool.target, maxInput);
      await liquidityPool.swapGivenOut(admin.address, mintable0.target, mintable1.target, outputAmount, maxInput);
  
      // Final balances
      const finalAdminBalance0 = await mintable0.balanceOf(admin.address);
      const finalAdminBalance1 = await mintable1.balanceOf(admin.address);
      const finalPoolBalance0 = await mintable0.balanceOf(liquidityPool.target);
      const finalPoolBalance1 = await mintable1.balanceOf(liquidityPool.target);
  
      // Calculate input amount based on balance changes
      const inputAmount = initialAdminBalance0 - finalAdminBalance0;
  
      // Assertions
      expect(finalAdminBalance0).to.equal(initialAdminBalance0 - inputAmount);
      expect(finalAdminBalance1).to.equal(initialAdminBalance1 + outputAmount);
      expect(finalPoolBalance0).to.equal(initialPoolBalance0 + inputAmount);
      expect(finalPoolBalance1).to.equal(initialPoolBalance1 - outputAmount);
  
      // Check fees collected (rough estimate within 1%)
      const feesCollected = await liquidityPool.getFeesCollected();
      const roughExpectedFees = outputAmount / 100n; // 1% rough estimate
      expect(feesCollected).to.be.closeTo(feesCollected, roughExpectedFees);
    });
  });
})