const utils = require("./testModules/utils");
const { getAddress, getCreateAddress } = require("ethers");

const MAX_ALLOCATION = 2n ** 88n - 1n
module.exports = async function deployAll() {
    const tokenName = "Diversified USD";
    const tokenSymbol = "USD1";
    const mintable0Decimals = 18n;
    const mintable0TargetAllocation = utils.formatAllocationFromDecimal(0.333333333333333333333333333333333)
    const mintable1Decimals = 20n;
    const mintable1TargetAllocation = utils.formatAllocationFromDecimal(0.333333333333333333333333333333333)
    const mintable2Decimals = 6n;
    //the remaining allocation goes to mintable2
    const mintable2TargetAllocation = MAX_ALLOCATION - mintable0TargetAllocation - mintable1TargetAllocation;
    const [admin, unpriviledged] = await hre.ethers.getSigners();
    const liquidityPoolAddress = getCreateAddress({
      from: admin.address,
      nonce: BigInt(await hre.ethers.provider.getTransactionCount(admin.address)) + 1n,
    });
    const minBalanceMultiplierChangeDelay = 100n
    const maxBalanceMultiplierChangePerSecondQ96 = utils.decimalToFixed(1.001)
    const indexToken = await hre.ethers.deployContract("IndexToken", [
      tokenName,
      tokenSymbol,
      liquidityPoolAddress,
      minBalanceMultiplierChangeDelay,
      maxBalanceMultiplierChangePerSecondQ96
    ]);

    const liquidityPool = await hre.ethers.deployContract("LiquidityPool", [
      await admin.getAddress(),
      await indexToken.getAddress(),
    ]);

    const liquidityPoolHelper = await hr.ethers.deployContract("LiquidityPoolHelper", [
      await liquidityPool.getAddress(),
      await indexToken.getAddress()
    ])

    const liquidityPool0 = await hre.ethers.deployContract("LiquidityPool", [
      await admin.getAddress(),
      await indexToken.getAddress(),
    ]);

    const liquidityPoolHelper0 = await hr.ethers.deployContract("LiquidityPoolHelper", [
      await liquidityPool0.getAddress(),
      await indexToken.getAddress()
    ])

    const liquidityPool1 = await hre.ethers.deployContract("LiquidityPool", [
      await admin.getAddress(),
      await indexToken.getAddress(),
    ]);

    const liquidityPoolHelper1 = await hr.ethers.deployContract("LiquidityPoolHelper", [
      await liquidityPool1.getAddress(),
      await indexToken.getAddress()
    ])

    const liquidityPool2 = await hre.ethers.deployContract("LiquidityPool", [
      await admin.getAddress(),
      await indexToken.getAddress(),
    ]);

    const liquidityPoolHelper2 = await hr.ethers.deployContract("LiquidityPoolHelper", [
      await liquidityPool2.getAddress(),
      await indexToken.getAddress()
    ])

    const liquidityPool3 = await hre.ethers.deployContract("LiquidityPool", [
      await admin.getAddress(),
      await indexToken.getAddress(),
    ]);

    const liquidityPoolHelper3 = await hr.ethers.deployContract("LiquidityPoolHelper", [
      await liquidityPool3.getAddress(),
      await indexToken.getAddress()
    ])

    const liquidityPool4 = await hre.ethers.deployContract("LiquidityPool", [
      await admin.getAddress(),
      await indexToken.getAddress(),
    ]);

    const liquidityPoolHelper4 = await hr.ethers.deployContract("LiquidityPoolHelper", [
      await liquidityPool4.getAddress(),
      await indexToken.getAddress()
    ])

    const mintable0 = await hre.ethers.deployContract("MintableERC20", [
      "Mintable0",
      "M0",
      mintable0Decimals,
    ]);
    const mintable1 = await hre.ethers.deployContract("MintableERC20", [
      "Mintable1",
      "M1",
      mintable1Decimals,
    ]);
    const mintable2 = await hre.ethers.deployContract("MintableERC20", [
      "Mintable2",
      "M2",
      mintable2Decimals,
    ]);

    await mintable0.mint(admin.address, utils.MAX_UINT_256 / 2n)
    await mintable1.mint(admin.address, utils.MAX_UINT_256 / 2n)
    await mintable2.mint(admin.address, utils.MAX_UINT_256 / 2n)
    await mintable0.approve(liquidityPool.target, utils.MAX_UINT_256)
    await mintable1.approve(liquidityPool.target, utils.MAX_UINT_256)
    await mintable2.approve(liquidityPool.target, utils.MAX_UINT_256)
    await indexToken.approve(liquidityPool.target, utils.MAX_UINT_256)

    await mintable0.mint(unpriviledged.address, utils.MAX_UINT_256 / 2n)
    await mintable1.mint(unpriviledged.address, utils.MAX_UINT_256 / 2n)
    await mintable2.mint(unpriviledged.address, utils.MAX_UINT_256 / 2n)
    await mintable0.attach(unpriviledged).approve(liquidityPool.target, utils.MAX_UINT_256)
    await mintable1.attach(unpriviledged).approve(liquidityPool.target, utils.MAX_UINT_256)
    await mintable2.attach(unpriviledged).approve(liquidityPool.target, utils.MAX_UINT_256)
    await indexToken.attach(unpriviledged).approve(liquidityPool.target, utils.MAX_UINT_256)


    assetParams0 = {
      decimals: mintable0Decimals,
      targetAllocation: mintable0TargetAllocation,
      assetAddress: getAddress(mintable0.target),
    }
    assetParams1 = {
      decimals: mintable1Decimals,
      targetAllocation: mintable1TargetAllocation,
      assetAddress: getAddress(mintable1.target),
    }
    assetParams2 = {
      decimals: mintable2Decimals,
      targetAllocation: mintable2TargetAllocation,
      assetAddress: getAddress(mintable2.target),
    }
    await liquidityPool.setTargetAssetParams([
      assetParams0,
      assetParams1,
      assetParams2,
    ]);
    
    const maxReserves = utils.MAX_UINT_256 / 2n
    const maxReservesIncreaseRateQ96 = utils.decimalToFixed(0.1);
    await liquidityPool.setMaxReserves(maxReserves);
    const setMaxReservesBlock = await hre.ethers.provider.getBlock('latest');
    const setMaxReservesTimestamp = setMaxReservesBlock.timestamp;
    await liquidityPool.setMaxReservesIncreaseRateQ96(maxReservesIncreaseRateQ96);
    await liquidityPool.setMintFeeQ96(utils.decimalToFixed(0.01)); // 1% mint fee
    await liquidityPool.setBurnFeeQ96(utils.decimalToFixed(0.02)); // 2% burn fee
    const poolMathWrapperFactory = await hre.ethers.getContractFactory("PoolMathWrapper");
    const poolMathWrapper = await poolMathWrapperFactory.deploy()

    const assetParamsNoMintable0 = [{
      assetAddress: assetParams1.assetAddress,
      targetAllocation: utils.formatAllocationFromDecimal(0.5),
      decimals: assetParams1.decimals
    }, {
      assetAddress: assetParams2.assetAddress,
      targetAllocation: MAX_ALLOCATION - utils.formatAllocationFromDecimal(0.5),
      decimals: assetParams2.decimals
    }]

    const assetParamsNoMintable1 = [{
      assetAddress: assetParams0.assetAddress,
      targetAllocation: utils.formatAllocationFromDecimal(0.5),
      decimals: assetParams0.decimals
    }, {
      assetAddress: assetParams2.assetAddress,
      targetAllocation: MAX_ALLOCATION - utils.formatAllocationFromDecimal(0.5),
      decimals: assetParams2.decimals
    }]

    const assetParamsNoMintable2 = [{
      assetAddress: assetParams0.assetAddress,
      targetAllocation: utils.formatAllocationFromDecimal(0.5),
      decimals: assetParams0.decimals
    }, {
      assetAddress: assetParams1.assetAddress,
      targetAllocation: MAX_ALLOCATION - utils.formatAllocationFromDecimal(0.5),
      decimals: assetParams1.decimals
    }]

    return {
      indexToken,
      liquidityPool,
      liquidityPool0,
      liquidityPool1,
      liquidityPool2,
      liquidityPool3,
      liquidityPool4,
      admin,
      unpriviledged,
      tokenName,
      tokenSymbol,
      mintable0,
      mintable1,
      mintable2,
      maxReserves,
      maxReservesIncreaseRateQ96,
      assetParams0,
      assetParams1,
      assetParams2,
      setMaxReservesTimestamp,
      poolMathWrapper,
      assetParamsNoMintable0,
      assetParamsNoMintable1,
      assetParamsNoMintable2,
      minBalanceMultiplierChangeDelay,
      maxBalanceMultiplierChangePerSecondQ96,
      liquidityPoolHelper,
      liquidityPoolHelper0,
      liquidityPoolHelper1,
      liquidityPoolHelper2,
      liquidityPoolHelper3,
      liquidityPoolHelper4
    };
  }