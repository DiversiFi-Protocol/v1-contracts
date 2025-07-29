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

async function testAdminControls(deployParams) {
  const liquidityPool = await indexToken.getLiquidityPool()
  
}

async function testPreMigration(deployParams) {
  const liquidityPool = deployParams.liquidityPool
  //should be able to mint and burn as expected
  await testMintNoMigration(indexToken, 0n)
  await testMintNoMigration(indexToken, BigInt(Math.random() * 1_000_000 * 10 ** 18))
  await testMintNoMigration(indexToken, 2n ** 160n - 1_000_000_000n)
  await testBurnNoMigration(indexToken, 0n)
  await testBurnNoMigration(indexToken, BigInt(Math.random() * 1_000_000 * 10 ** 18))
  await testBurnNoMigration(indexToken, await indexToken.balanceOf(await hre.ethers.getSigner()))
}

async function testMidMigration(indexToken) {

}

async function testPostMigration(indexToken) {

}

module.exports = {
  testPreMigration, testMidMigration, testPostMigration
}