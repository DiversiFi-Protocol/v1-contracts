const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const utils = require("../testModules/utils.js");
const deployAll = require("../deployAll.js");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("normal minting and burning activity", function() {
  it("minting and burning equal amounts should never result in less totalReserves than totalSupply", async function() {
    const {
      indexToken, reserveManager, reserveManager0, reserveManager1, reserveManager2, reserveManager3, reserveManager4, 
      admin, unpriviledged, tokenName, tokenSymbol, mintable0, mintable1, mintable2, maxReserves, maxReservesIncreaseRateQ96, 
      assetParams0, assetParams1, assetParams2, setMaxReservesTimestamp, poolMathWrapper, assetParamsNoMintable0, 
      assetParamsNoMintable1, assetParamsNoMintable2, minbalanceDivisorChangeDelay, maxbalanceDivisorChangePerSecondQ96 
    } = await loadFixture(deployAll)
    await reserveManager.setMintFeeQ96(0n)
    await reserveManager.setBurnFeeQ96(0n)
    await reserveManager.mint(utils.scale10Pow18(1_000_000n), "0x")
    var totalReservesScaled, totalSupply
    for(let i = 0; i < 100; i++) {
      const changeAmount = BigInt(Math.floor(Math.random() * (1_000_000 * 10 ** 18)))
      await reserveManager.mint(changeAmount, "0x")
      totalReservesScaled = await reserveManager.getTotalReservesScaled()
      totalSupply = await indexToken.totalSupply()
      expect(totalReservesScaled).to.be.greaterThanOrEqual(totalSupply)
      await reserveManager.burn(changeAmount, false, "0x")
      totalReservesScaled = await reserveManager.getTotalReservesScaled()
      totalSupply = await indexToken.totalSupply()
      expect(totalReservesScaled).to.be.greaterThanOrEqual(totalSupply)
    }
  })
})