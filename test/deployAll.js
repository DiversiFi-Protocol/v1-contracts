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
    const mintable3Decimals = 17n;
    const mintable4Decimals = 16n;
    //the remaining allocation goes to mintable2
    const mintable2TargetAllocation = MAX_ALLOCATION - mintable0TargetAllocation - mintable1TargetAllocation;
    const [admin, maintainer, unpriviledged] = await hre.ethers.getSigners()

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
    const mintable3 = await hre.ethers.deployContract("MintableERC20", [
      "Mintable3",
      "M3",
      mintable3Decimals,
    ]);
    const mintable4 = await hre.ethers.deployContract("MintableERC20", [
      "Mintable4",
      "M4",
      mintable4Decimals,
    ]);

    await mintable0.mint(admin.address, utils.MAX_UINT_256 / 2n)
    await mintable1.mint(admin.address, utils.MAX_UINT_256 / 2n)
    await mintable2.mint(admin.address, utils.MAX_UINT_256 / 2n)
    await mintable3.mint(admin.address, utils.MAX_UINT_256 / 2n)
    await mintable4.mint(admin.address, utils.MAX_UINT_256 / 2n)
    await mintable0.mint(unpriviledged.address, utils.MAX_UINT_256 / 2n)
    await mintable1.mint(unpriviledged.address, utils.MAX_UINT_256 / 2n)
    await mintable2.mint(unpriviledged.address, utils.MAX_UINT_256 / 2n)
    await mintable3.mint(unpriviledged.address, utils.MAX_UINT_256 / 2n)
    await mintable4.mint(unpriviledged.address, utils.MAX_UINT_256 / 2n)

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

    const reserveManagerAddress = getCreateAddress({
      from: admin.address,
      nonce: BigInt(await hre.ethers.provider.getTransactionCount(admin.address)) + 1n,
    });
    const minbalanceDivisorChangeDelay = 100n
    const maxbalanceDivisorChangePerSecondQ96 = utils.decimalToFixed(1.001)
    const indexToken = await hre.ethers.deployContract("IndexToken", [
      tokenName,
      tokenSymbol,
      reserveManagerAddress,
      minbalanceDivisorChangeDelay,
      maxbalanceDivisorChangePerSecondQ96
    ]);

    const assetParams = [ assetParams0, assetParams1, assetParams2 ];
    const approveAddresses = []

    const maxReserves = utils.MAX_UINT_256 / 2n
    const maxReservesIncreaseRateQ96 = utils.decimalToFixed(0.1);
    const mintFee = utils.decimalToFixed(0.01); // 1% mint fee
    const burnFee = utils.decimalToFixed(0.02); // 2% burn fee

    const reserveManager = await hre.ethers.deployContract("ReserveManagerV1", [
      await admin.getAddress(), await maintainer.getAddress(), await indexToken.getAddress(), mintFee,
      burnFee, maxReserves, maxReservesIncreaseRateQ96, assetParams
    ]);
    const setMaxReservesBlock = await hre.ethers.provider.getBlock('latest');
    const setMaxReservesTimestamp = setMaxReservesBlock.timestamp;
    approveAddresses.push(await reserveManager.getAddress())

    const reserveManagerHelpers = await hre.ethers.deployContract("ReserveManagerHelpers", [
      await reserveManager.getAddress(),
    ])
    approveAddresses.push(await reserveManagerHelpers.getAddress())

    const reserveManager0 = await hre.ethers.deployContract("ReserveManagerV1", [
      await admin.getAddress(), await maintainer.getAddress(), await indexToken.getAddress(), mintFee,
      burnFee, maxReserves, maxReservesIncreaseRateQ96, assetParams
    ]);
    approveAddresses.push(await reserveManager0.getAddress())

    const reserveManagerHelpers0 = await hre.ethers.deployContract("ReserveManagerHelpers", [
      await reserveManager0.getAddress(),
    ])
    approveAddresses.push(await reserveManagerHelpers0.getAddress())

    const reserveManager1 = await hre.ethers.deployContract("ReserveManagerV1", [
      await admin.getAddress(), await maintainer.getAddress(), await indexToken.getAddress(), mintFee,
      burnFee, maxReserves, maxReservesIncreaseRateQ96, assetParams
    ]);
    approveAddresses.push(await reserveManager1.getAddress())

    const reserveManagerHelpers1 = await hre.ethers.deployContract("ReserveManagerHelpers", [
      await reserveManager1.getAddress(),
    ])
    approveAddresses.push(await reserveManagerHelpers1.getAddress())

    const reserveManager2 = await hre.ethers.deployContract("ReserveManagerV1", [
      await admin.getAddress(), await maintainer.getAddress(), await indexToken.getAddress(), mintFee,
      burnFee, maxReserves, maxReservesIncreaseRateQ96, assetParams
    ]);
    approveAddresses.push(await reserveManager2.getAddress())

    const reserveManagerHelpers2 = await hre.ethers.deployContract("ReserveManagerHelpers", [
      await reserveManager2.getAddress(),
    ])
    approveAddresses.push(await reserveManagerHelpers2.getAddress())

    const reserveManager3 = await hre.ethers.deployContract("ReserveManagerV1", [
      await admin.getAddress(), await maintainer.getAddress(), await indexToken.getAddress(), mintFee,
      burnFee, maxReserves, maxReservesIncreaseRateQ96, assetParams
    ]);
    approveAddresses.push(await reserveManager3.getAddress())

    const reserveManagerHelpers3 = await hre.ethers.deployContract("ReserveManagerHelpers", [
      await reserveManager3.getAddress(),
    ])
    approveAddresses.push(await reserveManagerHelpers3.getAddress())

    const reserveManager4 = await hre.ethers.deployContract("ReserveManagerV1", [
      await admin.getAddress(), await maintainer.getAddress(), await indexToken.getAddress(), mintFee,
      burnFee, maxReserves, maxReservesIncreaseRateQ96, assetParams
    ]);
    approveAddresses.push(await reserveManager4.getAddress())

    const reserveManagerHelpers4 = await hre.ethers.deployContract("ReserveManagerHelpers", [
      await reserveManager4.getAddress(),
    ])
    approveAddresses.push(await reserveManagerHelpers4.getAddress())

    await Promise.all(approveAddresses.map(async address => {
      await mintable0.approve(address, utils.MAX_UINT_256)
      await mintable1.approve(address, utils.MAX_UINT_256)
      await mintable2.approve(address, utils.MAX_UINT_256)
      await mintable3.approve(address, utils.MAX_UINT_256)
      await mintable4.approve(address, utils.MAX_UINT_256)
      await indexToken.approve(address, utils.MAX_UINT_256)

      await mintable0.attach(unpriviledged).approve(address, utils.MAX_UINT_256)
      await mintable1.attach(unpriviledged).approve(address, utils.MAX_UINT_256)
      await mintable2.attach(unpriviledged).approve(address, utils.MAX_UINT_256)
      await mintable3.attach(unpriviledged).approve(address, utils.MAX_UINT_256)
      await mintable4.attach(unpriviledged).approve(address, utils.MAX_UINT_256)
      await indexToken.attach(unpriviledged).approve(address, utils.MAX_UINT_256)
    }))
    
    const poolMathWrapperFactory = await hre.ethers.getContractFactory("ReserveMathWrapper");
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
      reserveManager,
      reserveManager0,
      reserveManager1,
      reserveManager2,
      reserveManager3,
      reserveManager4,
      admin,
      maintainer,
      unpriviledged,
      tokenName,
      tokenSymbol,
      mintable0,
      mintable1,
      mintable2,
      mintable3,
      mintable4,
      mintable0Decimals,
      mintable1Decimals,
      mintable2Decimals,
      mintable3Decimals,
      mintable4Decimals,
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
      minbalanceDivisorChangeDelay,
      maxbalanceDivisorChangePerSecondQ96,
      reserveManagerHelpers,
      reserveManagerHelpers0,
      reserveManagerHelpers1,
      reserveManagerHelpers2,
      reserveManagerHelpers3,
      reserveManagerHelpers4
    };
  }