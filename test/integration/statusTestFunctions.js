const hre = require("hardhat");
const utils = require("../testModules/utils.js")
const expect = require("chai").expect;



async function testMintAndBurnNoMigration(liquidityPool) {
  const currentAssetParams = await liquidityPool.getCurrentAssetParamsList()
  const targetAssetParams = await liquidityPool.getTargetAssetParamsList()
  //expect tracked reserves to increase as expected with mint
  const mintAmount = BigInt(Math.random() * 1_000 ** 10 ** 18)
  const expectedScaledReservesIncreases = targetAssetParams.map(params => {
    return (mintAmount * params.targetAllocation) >> utils.ALLOCATION_SHIFT
  })

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