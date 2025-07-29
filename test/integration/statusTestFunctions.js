const hre = require("hardhat");
const utils = require("../testModules/utils.js")
const expect = require("chai").expect;

async function getAllReserves(liquidityPool) {
  const indexToken = await liquidityPool.getIndexToken()
  return Promise.all(
    targetAssetParams.map(async params => {
      scaledBalance = await liquidityPool.getSpecificReserves(params.assetAddress)
      trueBalance = await indexToken.balanceOf(liquidityPool.target)
      return { true: trueBalance, scaled: scaledBalance }
    })
  )
}

async function testMintNoMigration(indexToken, mintAmount) {
  const liquidityPool = await indexToken.getLiquidityPool()
  const targetAssetParams = await liquidityPool.getTargetAssetParamsList()
  //expect tracked reserves to increase as expected with mint
  const compoundingMintFeeQ96 = await liquidityPool.getCompoundingMintFeeQ96()
  const predictedDeposits = targetAssetParams.map(params => {
    return utils.predictDeposit(mintAmount, compoundingMintFeeQ96, params)
  })
  const startingReserves = await getAllReserves(liquidityPool)
  const startingTotalReservesScaled = await liquidityPool.getTotalReservesScaled()
  const startingMinterIndexBalance = await indexToken.balanceOf(hre.ethers.getSigner())
  const startingIndexTotalSupply = await indexToken.totalSupply()
  await liquidityPool.mint(mintAmount, "0x")
  const endingMinterIndexBalance = await indexToken.balanceOf(hre.ethers.getSigner())
  const endingIndexTotalSupply = await indexToken.totalSupply()
  const endingTotalReservesScaled = await liquidityPool.getTotalReservesScaled()
  const endingReserves = await getAllReserves(liquidityPool)
  var actualReservesChangeSum = 0n
  const actualReservesChanges = endingReserves.map((reserves, i) => {
    const trueChange = endingReserves[i].true - startingReserves[i].true
    const scaledChange = endingReserves[i].scaled - startingReserves[i].scaled
    actualReservesChangeSum += scaledChange
    return { true: trueChange, scaled: scaledChange }
  })
  expect(endingTotalReservesScaled - startingTotalReservesScaled).to.equal(actualReservesChangeSum, "mint does not produce symetric reserves increase")
  expect(endingMinterIndexBalance - startingMinterIndexBalance).to.equal(mintAmount, "insufficient minter balance increase")
  expect(endingIndexTotalSupply - startingIndexTotalSupply).to.equal(mintAmount, "insufficient mint total supply increase")
  predictedDeposits.forEach((predictDeposit, i) => {
    expect(predictDeposit.true).to.equal(actualReservesChanges[i].true, "true deposit of asset: "+targetAssetParams[i].assetAddress+" does not match")
    expect(predictDeposit.scaled).to.equal(actualReservesChanges[i].scaled, "scaled deposit of asset: "+targetAssetParams[i].assetAddress+" does not match")
  })
  expect(endingTotalReservesScaled).to.be.greaterThanOrEqual(endingIndexTotalSupply, "mint resulted in reserves defecit")
}

async function testBurnNoMigration(indexToken, burnAmount) {
  const liquidityPool = await indexToken.getLiquidityPool()
  const caller = await hre.ethers.getSigner()
  const currentAssetParams = await liquidityPool.getCurrentAssetParamsList()
  const burnFeeQ96 = await liquidityPool.getBurnFeeQ96()
  const initialIndexBalance = await indexToken.balanceOf(caller)
  expect(initialIndexBalance).to.be.greaterThanOrEqual(burnAmount, "caller doesn't have enough balance to burn")
  const totalReservesScaled = await indexToken.getTotalReservesScaled()
  const predictedWithdrawals = Promise.all(currentAssetParams.map(async params => {
    return utils.predictWithdrawal(
      burnAmount,
      burnFeeQ96, 
      params, 
      await indexToken.getSpecificReservesScaled(params.assetAddress), 
      totalReservesScaled
    )
  }))

  const startingReserves = await getAllReserves(liquidityPool)
  const startingTotalReservesScaled = await liquidityPool.getTotalReservesScaled()
  const startingBurnerIndexBalance = await indexToken.balanceOf(hre.ethers.getSigner())
  const startingIndexTotalSupply = await indexToken.totalSupply()
  await liquidityPool.burn(burnAmount, "0x")
  const endingBurnerIndexBalance = await indexToken.balanceOf(hre.ethers.getSigner())
  const endingIndexTotalSupply = await indexToken.totalSupply()
  const endingTotalReservesScaled = await liquidityPool.getTotalReservesScaled()
  const endingReserves = await getAllReserves(liquidityPool)
  var actualReservesChangeSum = 0n
  const actualReservesChanges = endingReserves.map((reserves, i) => {
    const trueChange = endingReserves[i].true - startingReserves[i].true
    const scaledChange = endingReserves[i].scaled - startingReserves[i].scaled
    actualReservesChangeSum += scaledChange
    return { true: trueChange, scaled: scaledChange }
  })

  expect(endingTotalReservesScaled - startingTotalReservesScaled).to.equal(actualReservesChangeSum, "burn does not produce symetric reserves increase")
  expect(startingBurnerIndexBalance - endingBurnerIndexBalance).to.equal(burnAmount, "insufficient burner balance decrease")
  expect(startingIndexTotalSupply - endingIndexTotalSupply).to.equal(burnAmount, "insufficient burn total supply decrease")
  predictedWithdrawals.forEach((predictWithdrawal, i) => {
    expect(predictWithdrawal.true).to.equal(actualReservesChanges[i].true, "true deposit of asset: "+targetAssetParams[i].assetAddress+" does not match")
    expect(predictWithdrawal.scaled).to.equal(actualReservesChanges[i].scaled, "scaled deposit of asset: "+targetAssetParams[i].assetAddress+" does not match")
  })
  expect(endingTotalReservesScaled).to.be.greaterThanOrEqual(endingIndexTotalSupply, "burn resulted in reserves defecit")
}

async function testAdminControlsNoMigration(deployParams) {
  //setAdmin
  await expect(
    deployParams.liquidityPool.connect(unpriviledged).setAdmin(unpriviledged)
  ).to.be.revertedWith("only_admin")
  await deployParams.liquidityPool.setAdmin(unpriviledged)
  await deployParams.liquidityPool.connect(unpriviledged).setAdmin(deployParams.admin)

  //setMintFeeQ96
  const startingMintFee = await deployParams.liquidityPool.getMintFeeQ96()
  const startingCompoundingMintFee = await deployParams.liquidityPool.getCompoundingMintFeeQ96()
  const mintFee2 = utils.decimalToFixed(0.69)
  await deployParams.liquidityPool.setMintFeeQ96(mintFee2)
  expect(await liquidityPool.getMintFeeQ96()).to.equal(mintFee2)
  expect(await liquidityPool.getCompoundingMintFeeQ96()).to.equal(utils.calcCompoundingFeeRate(mintFee2))
  await deployParams.liquidityPool.setMintFeeQ96(startingMintFee)
  expect(await liquidityPool.getMintFeeQ96()).to.equal(startingMintFee)
  expect(await liquidityPool.getCompoundingMintFeeQ96()).to.equal(startingCompoundingMintFee)

  //setBurnFeeQ96
  const startingBurnFee = await deployParams.liquidityPool.getBurnFeeQ96()
  const burnFee2 = utils.decimalToFixed(0.69)
  await deployParams.liquidityPool.setBurnFeeQ96(burnFee2)
  expect(await liquidityPool.getBurnFeeQ96()).to.equal(burnFee2)
  await deployParams.liquidityPool.setBurnFeeQ96(startingBurnFee)
  expect(await liquidityPool.getBurnFeeQ96()).to.equal(startingBurnFee)

  //setMaxReserves
  const startingMaxReserves = await deployParams.liquidityPool.getMaxReserves()
  const maxReserves2 = 42069n;
  await deployParams.liquidityPool.setMaxReserves(maxReserves2)
  expect(
    await deployParams.liquidityPool.getMaxReserves()
  ).to.equal(maxReserves2)
  await deployParams.liquidityPool.setMaxReserves(startingMaxReserves)
  expect(
    await deployParams.liquidityPool.getAllReserves()
  ).to.equal(startingMaxReserves)

  //setMaxReservesIncreaseRateQ96
  const startingMaxReservesIncreaseRateQ96 = await deployParams.liquidityPool.getMaxReservesIncreaseRateQ96()
  const maxReservesIncreaseRateQ962 = 42069n;
  await deployParams.liquidityPool.setMaxReservesIncreaseRateQ96(maxReservesIncreaseRateQ962)
  expect(
    await deployParams.liquidityPool.getMaxReservesIncreaseRateQ96()
  ).to.equal(maxReservesIncreaseRateQ962)
  await deployParams.liquidityPool.setMaxReservesIncreaseRateQ96(startingMaxReservesIncreaseRateQ96)
  expect(
    await deployParams.liquidityPool.getAllReservesIncreaseRateQ96()
  ).to.equal(startingMaxReservesIncreaseRateQ96)

  //setMaxReservesIncreaseCooldown
  const startingMaxReservesIncreaseCooldown = await deployParams.liquidityPool.getMaxReservesIncreaseCooldown()
  const maxReservesIncreaseRCooldown = 42069n;
  await deployParams.liquidityPool.setMaxReservesIncreaseCooldown(maxReservesIncreaseRCooldown)
  expect(
    await deployParams.liquidityPool.getMaxReservesIncreaseCooldown()
  ).to.equal(maxReservesIncreaseRCooldown)
  await deployParams.liquidityPool.setMaxReservesIncreaseCooldown(startingMaxReservesIncreaseCooldown)
  expect(
    await deployParams.liquidityPool.getAllReservesIncreaseCooldown()
  ).to.equal(startingMaxReservesIncreaseCooldown)

  //setIsMintEnabled
  expect(await deployParams.liquidityPool.getIsMintEnabled()).to.equal(true)
  await deployParams.liquidityPool.setIsMintEnabled(false)
  expect(await deployParams.liquidityPool.getIsMintEnabled()).to.equal(false)
  await deployParams.liquidityPool.setIsMintEnabled(true)
  expect(await deployParams.liquidityPool.getIsMintEnabled()).to.equal(true)

  //increaseEqualizationBounty
  const bountyAmount = 42069n
  await deployParams.liquidityPool.mint(bountyAmount)
  await deployParams.indexToken.burn(bountyAmount)
  const bountyBefore = await deployParams.liquidityPool.getEqualizationBounty()
  await deployParams.liquidityPool.increaseEqualizationBounty(bountyAmount)
  const bountyAfter = await deployParams.liquidityPool.getEqualizationBounty()
  expect(bountyAfter - bountyBefore).to.equal(bountyAmount)
}

async function testMintMidMigration(deployParams, nextPool) {
  expect(deployParams.liquidityPool).mint(42069n, "0x").to.be.revertedWith("liquidity pool is migrating")
  nextPool.mint(utils.scale10Pow18(1_000_000n))
  
}

async function testBurnMidMigration(deployParams) {

}

async function testAdminControlsMidMigration(deployParams) {

}

async function testPreMigration(deployParams) {
  const liquidityPool = deployParams.liquidityPool
  //should be able to mint and burn as expected
  await testMintNoMigration(deployParams.indexToken, 0n)
  await testMintNoMigration(deployParams.indexToken, BigInt(Math.random() * 1_000_000 * 10 ** 18))
  await testMintNoMigration(deployParams.indexToken, 2n ** 160n - 1_000_000_000n)
  await testBurnNoMigration(deployParams.indexToken, 0n)
  await testBurnNoMigration(deployParams.indexToken, BigInt(Math.random() * 1_000_000 * 10 ** 18))
  await testBurnNoMigration(deployParams.indexToken, await deployParams.indexToken.balanceOf(await hre.ethers.getSigner()))
  await testAdminControlsNoMigration(deployParams)
}

async function testMidMigration(indexToken) {

}

async function testPostMigration(indexToken) {

}

module.exports = {
  testPreMigration, testMidMigration, testPostMigration
}