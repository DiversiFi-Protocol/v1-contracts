const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const hre = require("hardhat");
const { getAddress, parseGwei, getCreateAddress, maxUint16 } = require("ethers");
const utils = require("../testModules/utils.js");
const { expect } = require("chai")
const { assetParams0, assetParams1, assetParams2 } = require("../../deployments/assetParams.js");

const ONE_BILLION = 1_000_000_000n
const DECIMAL_SCALE = 18n
describe("BackingPool - Getters", function () {
  async function deployAll() {
    const tokenName = "Diversified USD";
    const tokenSymbol = "USD1";
    const [admin, unpriviledged] = await hre.ethers.getSigners();
    const backingPoolAddress = getCreateAddress({
      from: admin.address,
      nonce: 2n,
    });

    const poolMathLibraryFactory = await hre.ethers.getContractFactory("PoolMath")
    const poolMathLibrary = await poolMathLibraryFactory.deploy()

    const backedToken = await hre.ethers.deployContract("BackedToken", [
      tokenName,
      tokenSymbol,
      backingPoolAddress,
      admin.address,
    ]);

    const maxReservesLimitRatioQ128 = utils.decimalToFixed(0.1)

    const backingPool = await hre.ethers.deployContract("BackingPool", [
      await admin.getAddress(),
      await backedToken.getAddress(),
      ethers.MaxUint256,
      maxReservesLimitRatioQ128
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
    await mintable0.approve(backingPool.target, utils.MAX_UINT_256)
    await mintable1.approve(backingPool.target, utils.MAX_UINT_256)
    await mintable2.approve(backingPool.target, utils.MAX_UINT_256)

    await mintable0.mint(unpriviledged.address, utils.MAX_UINT_256 / 2n)
    await mintable1.mint(unpriviledged.address, utils.MAX_UINT_256 / 2n)
    await mintable2.mint(unpriviledged.address, utils.MAX_UINT_256 / 2n)
    await mintable0.attach(unpriviledged).approve(backingPool.target, utils.MAX_UINT_256)
    await mintable1.attach(unpriviledged).approve(backingPool.target, utils.MAX_UINT_256)
    await mintable2.attach(unpriviledged).approve(backingPool.target, utils.MAX_UINT_256)

    // @ts-ignore
    await backingPool.setAssetParams([mintable0.target, mintable1.target, mintable2.target], [assetParams0, assetParams1, assetParams2]);

    return {
      backedToken,
      backingPool,
      admin,
      unpriviledged,
      tokenName,
      tokenSymbol,
      mintable0,
      mintable1,
      mintable2,
      maxReservesLimitRatioQ128
    };
  }

  it("Deployments", async () => {
    const { backedToken, backingPool, admin, tokenName, tokenSymbol } = await loadFixture(deployAll);

    // backed token
    expect(await backedToken.backingPool()).to.equal(getAddress(backingPool.target));
    expect(await backedToken.admin()).to.equal(getAddress(admin.address));
    expect(await backedToken.name()).to.equal(tokenName);
    expect(await backedToken.symbol()).to.equal(tokenSymbol);

    // backing pool
    expect(await backingPool.getBackedToken()).to.equal(getAddress(backedToken.target));
    expect(await backingPool.getAdmin()).to.equal(getAddress(admin.address));
  });

  it("getMaxReservesLimit", async function () {
    const { backingPool } = await loadFixture(deployAll);

    // Call the getMaxReservesLimit function
    const result = await backingPool.getMaxReservesLimit();

    // Assert that the result matches the expected value
    expect(result).to.equal(ethers.MaxUint256);
  })

  it("getMaxReservesLimitRatioQ128", async function () {
    const { backingPool, maxReservesLimitRatioQ128 } = await loadFixture(deployAll);

    // Call the getMaxReservesLimitRatioQ128 function
    const result = await backingPool.getMaxReservesLimitRatioQ128();

    // Assert that the result matches the expected value
    expect(result).to.equal(maxReservesLimitRatioQ128);
  })

  it("getMintFeeQ128", async function() {
    const { backingPool } = await loadFixture(deployAll);
    // Set the mint fee to a random value
    const randomMintFee = utils.decimalToFixed(0.01); // Example: 1% mint fee
    await backingPool.setMintFeeQ128(randomMintFee);

    // Assert that the mint fee was set correctly
    const setMintFee = await backingPool.getMintFeeQ128();
    expect(setMintFee).to.equal(randomMintFee);
  })

  it("getBurnFeeQ128", async function() {
    const { backingPool } = await loadFixture(deployAll);
    // Set the burn fee to a random value
    const randomBurnFee = utils.decimalToFixed(0.02); // Example: 2% burn fee
    await backingPool.setBurnFeeQ128(randomBurnFee);

    // Assert that the burn fee was set correctly
    const setBurnFee = await backingPool.getBurnFeeQ128();
    expect(setBurnFee).to.equal(randomBurnFee);
  })

  it("getIsSwapEnabled", async function () {
    const { backingPool } = await loadFixture(deployAll);
    const result = await backingPool.getIsSwapEnabled();
    expect(result).to.equal(true);
  })

  it("getIsDirectMintEnabled", async () => {
    const { backingPool } = await loadFixture(deployAll);
    const result = await backingPool.getIsDirectMintEnabled();
    expect(result).to.equal(true);
  })

  it("getFeesCollected", async function () {
    const { backingPool } = await loadFixture(deployAll);
    const result = await backingPool.getFeesCollected();
    expect(result).to.equal(0n);
  })

  it("getBackedToken", async function () {
    const { backedToken, backingPool } = await loadFixture(deployAll);
    const result = await backingPool.getBackedToken();
    expect(result).to.equal(getAddress(backedToken.target));
  });

  it("getAdmin", async function () {
    const { admin, backingPool } = await loadFixture(deployAll);
    const result = await backingPool.getAdmin();
    expect(result).to.equal(getAddress(admin.address));
  });

  it("getAllAssets", async function () {
    const { backingPool, mintable0, mintable1, mintable2 } = await loadFixture(deployAll);

    // Call the getAllAssets function
    const allAssets = await backingPool.getAllAssets();

    // Assert that the returned assets match the expected assets
    expect(allAssets.length).to.equal(3); // Ensure there are 3 assets
    expect(allAssets[0]).to.equal(getAddress(mintable0.target));
    expect(allAssets[1]).to.equal(getAddress(mintable1.target));
    expect(allAssets[2]).to.equal(getAddress(mintable2.target));
  });

  it("getAsset", async function () {
    const { backingPool, mintable0, mintable1, mintable2, mintable3 } = await loadFixture(deployAll);
    const result0 = await backingPool.getAsset(0n);
    expect(result0).to.equal(getAddress(mintable0.target));

    const result1 = await backingPool.getAsset(1n);
    expect(result1).to.equal(getAddress(mintable1.target));

    const result2 = await backingPool.getAsset(2n);
    expect(result2).to.equal(getAddress(mintable2.target));
  });

  it("getAssetParams", async function () {
    const checkAssetParamsEquivalence = (result, params) => {
      expect(result.assetAddress).to.equal(params.assetAddress);
      expect(result.decimals).to.equal(params.decimals);
      expect(result.maxAllocation).to.equal(params.maxAllocation);
      expect(result.targetAllocation).to.equal(params.targetAllocation);
      for (let i = 0; i < params.tickBoundaries; i++) {
        expect(result.tickBoundaries[i]).to.equal(params.tickBoundaries[i])
        expect(result.tickData[i].allocation).to.equal(params.tickData[i].allocation)
        expect(result.tickData[i].price).to.equal(params.tickData[i].price)
        expect(result.tickData[i].mLower).to.equal(params.tickData[i].mLower)
      }
    }
    const { backingPool, mintable0, mintable1, mintable2 } = await loadFixture(deployAll);
    const result0 = await backingPool.getAssetParams(mintable0.target);
    checkAssetParamsEquivalence(result0, assetParams0)
    const result1 = await backingPool.getAssetParams(mintable1.target);
    checkAssetParamsEquivalence(result1, assetParams1)
    const result2 = await backingPool.getAssetParams(mintable2.target);
    checkAssetParamsEquivalence(result2, assetParams2)
  });

  it("getSpecificReservesScaled", async function () {
    const { backingPool, mintable0, mintable1, mintable2, admin } = await loadFixture(deployAll);
    const result = await backingPool.getSpecificReservesScaled(mintable0.target);
    expect(result).to.equal(0n);

    // Mint 3 million tokens with 18 decimal places
    await backingPool.mint(ethers.parseEther("3000000"), admin.address);

    // Expect specificReservesScaled of all assets to equal 1 million with 18 decimal places
    const result0 = await backingPool.getSpecificReservesScaled(mintable0.target);
    const result1 = await backingPool.getSpecificReservesScaled(mintable1.target);
    const result2 = await backingPool.getSpecificReservesScaled(mintable2.target);

    // Check that results are close to 1 million with 18 decimal places plus or minus 1 million / 1 billion
    const million = ethers.parseEther("1000000");
    const tolerance = million / 1_000_000_000n;
    expect(result0).to.be.closeTo(million, tolerance);
    expect(result1).to.be.closeTo(million, tolerance);
    expect(result2).to.be.closeTo(million, tolerance);
  });

  it("getTotalReservesScaled", async function () {
    const { backingPool, mintable0, mintable1, mintable2, admin } = await loadFixture(deployAll);

    // Initially, total reserves should be 0
    const initialTotalReserves = await backingPool.getTotalReservesScaled();
    expect(initialTotalReserves).to.equal(0n);

    // Mint 3 million tokens with 18 decimal places
    await backingPool.mint(ethers.parseEther("3000000"), admin.address);

    // Expect totalReservesScaled to equal 3 million with 18 decimal places
    const totalReserves = await backingPool.getTotalReservesScaled();
    const expectedTotal = ethers.parseEther("3000000");
    const tolerance = expectedTotal / 1_000_000_000n; // 1 billionth tolerance

    expect(totalReserves).to.be.closeTo(expectedTotal, tolerance);
  });

  it("getReserves", async function () {
    const { backingPool, mintable0, mintable1, mintable2, admin } = await loadFixture(deployAll);

    // Initially, reserves for all assets should be 0
    const initialReserves0 = await backingPool.getReserves(mintable0.target);
    const initialReserves1 = await backingPool.getReserves(mintable1.target);
    const initialReserves2 = await backingPool.getReserves(mintable2.target);

    expect(initialReserves0).to.equal(0n);
    expect(initialReserves1).to.equal(0n);
    expect(initialReserves2).to.equal(0n);

    // Mint 3 million tokens with 18 decimal places
    await backingPool.mint(ethers.parseEther("3000000"), admin.address);

    // Get the reserves for each asset
    const reserves0 = await backingPool.getReserves(mintable0.target);
    const reserves1 = await backingPool.getReserves(mintable1.target);
    const reserves2 = await backingPool.getReserves(mintable2.target);

    // Get the decimals for each asset from the assetParams map
    const assetParams0 = await backingPool.getAssetParams(mintable0.target);
    const assetParams1 = await backingPool.getAssetParams(mintable1.target);
    const assetParams2 = await backingPool.getAssetParams(mintable2.target);

    const decimals0 = assetParams0.decimals;
    const decimals1 = assetParams1.decimals;
    const decimals2 = assetParams2.decimals;

    // Calculate the expected reserves in the correct decimal places
    const expectedReserves0 = ethers.parseUnits("1000000", decimals0);
    const expectedReserves1 = ethers.parseUnits("1000000", decimals1);
    const expectedReserves2 = ethers.parseUnits("1000000", decimals2);

    // Define a tolerance of one billionth
    const tolerance0 = expectedReserves0 / 1_000_000_000n;
    const tolerance1 = expectedReserves1 / 1_000_000_000n;
    const tolerance2 = expectedReserves2 / 1_000_000_000n;

    // Assert that the reserves are within the tolerance
    expect(reserves0).to.be.closeTo(expectedReserves0, tolerance0);
    expect(reserves1).to.be.closeTo(expectedReserves1, tolerance1);
    expect(reserves2).to.be.closeTo(expectedReserves2, tolerance2);
  });

  it("getPriceQ128 for all assets after minting", async function () {
    const { backingPool, mintable0, mintable1, mintable2, admin } = await loadFixture(deployAll);

    // Mint 1 million tokens with 18 decimal places
    await backingPool.mint(ethers.parseEther("1000000"), admin.address);

    // Define the expected price using utils
    const expectedPrice = utils.decimalToFixed(1); // Convert decimal 1 to fixed-point format
    const tolerance = expectedPrice / 1_000_000_000n; // 1 billionth tolerance

    // Get the price for each asset
    const price0Raw = await backingPool.getPriceQ128(mintable0.target);
    const price1Raw = await backingPool.getPriceQ128(mintable1.target);
    const price2Raw = await backingPool.getPriceQ128(mintable2.target);


    // Assert that the prices are close to the expected price
    expect(price0Raw).to.be.closeTo(expectedPrice, tolerance);
    expect(price1Raw).to.be.closeTo(expectedPrice, tolerance);
    expect(price2Raw).to.be.closeTo(expectedPrice, tolerance);
  });

  it("getLowerTick for all assets", async function () {
    const { backingPool, mintable0, mintable1, mintable2, admin } = await loadFixture(deployAll);

    // Define the index of the lower tick to test against
    const lowerTickIndex = 2;
    await backingPool.mint(ethers.parseEther("3000000"), admin.address);

    // Get the asset parameters for each token
    const assetParams0 = await backingPool.getAssetParams(mintable0.target);
    const assetParams1 = await backingPool.getAssetParams(mintable1.target);
    const assetParams2 = await backingPool.getAssetParams(mintable2.target);

    // Get the expected lower tick data for each token
    const expectedLowerTick0 = assetParams0.tickData[lowerTickIndex];
    const expectedLowerTick1 = assetParams1.tickData[lowerTickIndex];
    const expectedLowerTick2 = assetParams2.tickData[lowerTickIndex];

    // Get the actual lower tick for each token
    const lowerTick0 = await backingPool.getLowerTick(mintable0.target);
    const lowerTick1 = await backingPool.getLowerTick(mintable1.target);
    const lowerTick2 = await backingPool.getLowerTick(mintable2.target);

    // Assert that the actual lower ticks match the expected lower ticks
    expect(lowerTick0).to.deep.equal(expectedLowerTick0);
    expect(lowerTick1).to.deep.equal(expectedLowerTick1);
    expect(lowerTick2).to.deep.equal(expectedLowerTick2);
  });
})