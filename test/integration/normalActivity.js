const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const utils = require("../testModules/utils.js");
const deployAll = require("../deployAll.js");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("normal minting and burning activity", function() {
  it("minting and burning equal amounts should never result in less totalReserves than totalSupply", async function() {
    const {
      indexToken, liquidityPool, liquidityPool0, liquidityPool1, liquidityPool2, liquidityPool3, liquidityPool4, 
      admin, unpriviledged, tokenName, tokenSymbol, mintable0, mintable1, mintable2, maxReserves, maxReservesIncreaseRateQ96, 
      assetParams0, assetParams1, assetParams2, setMaxReservesTimestamp, poolMathWrapper, assetParamsNoMintable0, 
      assetParamsNoMintable1, assetParamsNoMintable2, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96 
    } = await loadFixture(deployAll)
    await liquidityPool.setMintFeeQ96(0n)
    await liquidityPool.setBurnFeeQ96(0n)
    await liquidityPool.mint(utils.scale10Pow18(1_000_000n), "0x")
    var totalReservesScaled, totalSupply
    for(let i = 0; i < 100; i++) {
      const changeAmount = BigInt(Math.floor(Math.random() * (1_000_000 * 10 ** 18)))
      await liquidityPool.mint(changeAmount, "0x")
      totalReservesScaled = await liquidityPool.getTotalReservesScaled()
      totalSupply = await indexToken.totalSupply()
      expect(totalReservesScaled).to.be.greaterThanOrEqual(totalSupply)
      await liquidityPool.burn(changeAmount, "0x")
      totalReservesScaled = await liquidityPool.getTotalReservesScaled()
      totalSupply = await indexToken.totalSupply()
      expect(totalReservesScaled).to.be.greaterThanOrEqual(totalSupply)
    }
  })
})