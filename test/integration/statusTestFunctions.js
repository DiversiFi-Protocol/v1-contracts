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

async function testMintNoMigration(indexToken) {
  const liquidityPool = await indexToken.getLiquidityPool()
  const targetAssetParams = await liquidityPool.getTargetAssetParamsList()
  //expect tracked reserves to increase as expected with mint
  const mintAmount = BigInt(Math.random() * 1_000 ** 10 ** 18)
  const mintFeeQ96 = await liquidityPool.getMintFeeQ96()
  const predictedDeposits = targetAssetParams.map(params => {
    return utils.predictDeposit(mintAmount, mintFeeQ96, targetAssetParams)
  })
  const startingReserves = await getAllReserves(liquidityPool)
  const startingTotalReservesScaled = await liquidityPool.getTotalReservesScaled()
  await liquidityPool.mint(mintAmount, "0x")
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

  predictedDeposits.forEach((predictDeposit, i) => {
    expect(predictDeposit.true).to.equal(actualReservesChanges[i].true, "true deposit of asset: "+targetAssetParams[i].assetAddress+" does not match")
    expect(predictDeposit.scaled).to.equal(actualReservesChanges[i].scaled, "scaled deposit of asset: "+targetAssetParams[i].assetAddress+" does not match")
  })
}

async function TestBurnNoMigration(indexToken) {
  const liquidityPool = await indexToken.getLiquidityPool()
  const currentAssetParams = await liquidityPool.getCurrentAssetParamsList()

}

async function testPreMigration(indexToken) {
  const liquidityPool = await indexToken.getLiquidityPool()
  //should be able to mint and burn as expected
  
}

async function testMidMigration(indexToken) {

}

async function testPostMigration(indexToken) {

}

module.exports = {
  testPreMigration, testMidMigration, testPostMigration
}