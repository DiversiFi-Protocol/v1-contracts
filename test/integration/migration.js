const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const hre = require("hardhat");
const utils = require("../testModules/utils.js")
const deployAll = require("../deployAll.js");
const expect = require("chai").expect;

async function increaseTime(seconds) {
  await ethers.provider.send("evm_increaseTime", [seconds]);

  // Mine a new block so the increased time takes effect
  await ethers.provider.send("evm_mine", []);
}

describe("migration - complete lifecycle", function() {
  it("normal migration", async function() {
    const {
      indexToken, liquidityPool, liquidityPool0, liquidityPool1, liquidityPool2, liquidityPool3, liquidityPool4, 
      admin, unpriviledged, tokenName, tokenSymbol, mintable0, mintable1, mintable2, maxReserves, maxReservesIncreaseRateQ96, 
      assetParams0, assetParams1, assetParams2, setMaxReservesTimestamp, poolMathWrapper, assetParamsNoMintable0, 
      assetParamsNoMintable1, assetParamsNoMintable2, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96 
    } = await loadFixture(deployAll)
    await liquidityPool.mint(utils.scale10Pow18(1_000_000n), "0x")
    await liquidityPool.startEmigration(
      liquidityPool0,
      minBalanceMultiplierChangeDelay,
      maxBalanceMultiplierChangePerSecondQ96
    )
    await liquidityPool0.mint(utils.scale10Pow18(1_000_000n), "0x")

    await liquidityPool.burn(liquidityPool.getTotalReservesScaled(), "0x")
    await liquidityPool.finishEmigration()
  })

  it("multiple migrations", async function() {

  })

  describe("migration during allocation change", function() {
    it("add an asset", async function() {
      const {
        indexToken, liquidityPool, liquidityPool0, liquidityPool1, liquidityPool2, liquidityPool3, liquidityPool4, 
        admin, unpriviledged, tokenName, tokenSymbol, mintable0, mintable1, mintable2, maxReserves, maxReservesIncreaseRateQ96, 
        assetParams0, assetParams1, assetParams2, setMaxReservesTimestamp, poolMathWrapper, assetParamsNoMintable0, 
        assetParamsNoMintable1, assetParamsNoMintable2, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96 
      } = await loadFixture(deployAll)
    })

    it("remove an asset", async function() {
      const {
        indexToken, liquidityPool, liquidityPool0, liquidityPool1, liquidityPool2, liquidityPool3, liquidityPool4, 
        admin, unpriviledged, tokenName, tokenSymbol, mintable0, mintable1, mintable2, maxReserves, maxReservesIncreaseRateQ96, 
        assetParams0, assetParams1, assetParams2, setMaxReservesTimestamp, poolMathWrapper, assetParamsNoMintable0, 
        assetParamsNoMintable1, assetParamsNoMintable2, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96 
      } = await loadFixture(deployAll)
    })

    it("add an asset during normal allocation change", async function() {
      const {
        indexToken, liquidityPool, liquidityPool0, liquidityPool1, liquidityPool2, liquidityPool3, liquidityPool4, 
        admin, unpriviledged, tokenName, tokenSymbol, mintable0, mintable1, mintable2, maxReserves, maxReservesIncreaseRateQ96, 
        assetParams0, assetParams1, assetParams2, setMaxReservesTimestamp, poolMathWrapper, assetParamsNoMintable0, 
        assetParamsNoMintable1, assetParamsNoMintable2, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96 
      } = await loadFixture(deployAll)
    })

    it("remove an asset during normal allocation change", async function() {
      const {
        indexToken, liquidityPool, liquidityPool0, liquidityPool1, liquidityPool2, liquidityPool3, liquidityPool4, 
        admin, unpriviledged, tokenName, tokenSymbol, mintable0, mintable1, mintable2, maxReserves, maxReservesIncreaseRateQ96, 
        assetParams0, assetParams1, assetParams2, setMaxReservesTimestamp, poolMathWrapper, assetParamsNoMintable0, 
        assetParamsNoMintable1, assetParamsNoMintable2, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96 
      } = await loadFixture(deployAll)
    })

    it("normal allocation change while adding an asset", async function() {
      const {
        indexToken, liquidityPool, liquidityPool0, liquidityPool1, liquidityPool2, liquidityPool3, liquidityPool4, 
        admin, unpriviledged, tokenName, tokenSymbol, mintable0, mintable1, mintable2, maxReserves, maxReservesIncreaseRateQ96, 
        assetParams0, assetParams1, assetParams2, setMaxReservesTimestamp, poolMathWrapper, assetParamsNoMintable0, 
        assetParamsNoMintable1, assetParamsNoMintable2, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96 
      } = await loadFixture(deployAll)
    })

    it("normal allocation change while removing an asset", async function() {
      const {
        indexToken, liquidityPool, liquidityPool0, liquidityPool1, liquidityPool2, liquidityPool3, liquidityPool4, 
        admin, unpriviledged, tokenName, tokenSymbol, mintable0, mintable1, mintable2, maxReserves, maxReservesIncreaseRateQ96, 
        assetParams0, assetParams1, assetParams2, setMaxReservesTimestamp, poolMathWrapper, assetParamsNoMintable0, 
        assetParamsNoMintable1, assetParamsNoMintable2, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96 
      } = await loadFixture(deployAll)
    })

    it("add an asset while adding an asset", async function() {
      const {
        indexToken, liquidityPool, liquidityPool0, liquidityPool1, liquidityPool2, liquidityPool3, liquidityPool4, 
        admin, unpriviledged, tokenName, tokenSymbol, mintable0, mintable1, mintable2, maxReserves, maxReservesIncreaseRateQ96, 
        assetParams0, assetParams1, assetParams2, setMaxReservesTimestamp, poolMathWrapper, assetParamsNoMintable0, 
        assetParamsNoMintable1, assetParamsNoMintable2, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96 
      } = await loadFixture(deployAll)
    })

    it("add an asset while removing an asset", async function() {
      const {
        indexToken, liquidityPool, liquidityPool0, liquidityPool1, liquidityPool2, liquidityPool3, liquidityPool4, 
        admin, unpriviledged, tokenName, tokenSymbol, mintable0, mintable1, mintable2, maxReserves, maxReservesIncreaseRateQ96, 
        assetParams0, assetParams1, assetParams2, setMaxReservesTimestamp, poolMathWrapper, assetParamsNoMintable0, 
        assetParamsNoMintable1, assetParamsNoMintable2, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96 
      } = await loadFixture(deployAll)
    })

    it("remove an asset while adding an asset", async function() {
      const {
        indexToken, liquidityPool, liquidityPool0, liquidityPool1, liquidityPool2, liquidityPool3, liquidityPool4, 
        admin, unpriviledged, tokenName, tokenSymbol, mintable0, mintable1, mintable2, maxReserves, maxReservesIncreaseRateQ96, 
        assetParams0, assetParams1, assetParams2, setMaxReservesTimestamp, poolMathWrapper, assetParamsNoMintable0, 
        assetParamsNoMintable1, assetParamsNoMintable2, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96 
      } = await loadFixture(deployAll)
    })

    it("remove an asset while removing an asset", async function() {
      const {
        indexToken, liquidityPool, liquidityPool0, liquidityPool1, liquidityPool2, liquidityPool3, liquidityPool4, 
        admin, unpriviledged, tokenName, tokenSymbol, mintable0, mintable1, mintable2, maxReserves, maxReservesIncreaseRateQ96, 
        assetParams0, assetParams1, assetParams2, setMaxReservesTimestamp, poolMathWrapper, assetParamsNoMintable0, 
        assetParamsNoMintable1, assetParamsNoMintable2, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96 
      } = await loadFixture(deployAll)
    })
  })

  describe("allocation change during migration", function() {
    it("add an asset", async function() {
      const {
        indexToken, liquidityPool, liquidityPool0, liquidityPool1, liquidityPool2, liquidityPool3, liquidityPool4, 
        admin, unpriviledged, tokenName, tokenSymbol, mintable0, mintable1, mintable2, maxReserves, maxReservesIncreaseRateQ96, 
        assetParams0, assetParams1, assetParams2, setMaxReservesTimestamp, poolMathWrapper, assetParamsNoMintable0, 
        assetParamsNoMintable1, assetParamsNoMintable2, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96 
      } = await loadFixture(deployAll)
    })

    it("remove an asset", async function() {
      const {
        indexToken, liquidityPool, liquidityPool0, liquidityPool1, liquidityPool2, liquidityPool3, liquidityPool4, 
        admin, unpriviledged, tokenName, tokenSymbol, mintable0, mintable1, mintable2, maxReserves, maxReservesIncreaseRateQ96, 
        assetParams0, assetParams1, assetParams2, setMaxReservesTimestamp, poolMathWrapper, assetParamsNoMintable0, 
        assetParamsNoMintable1, assetParamsNoMintable2, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96 
      } = await loadFixture(deployAll)
    })

    it("add an asset during normal allocation change", async function() {
      const {
        indexToken, liquidityPool, liquidityPool0, liquidityPool1, liquidityPool2, liquidityPool3, liquidityPool4, 
        admin, unpriviledged, tokenName, tokenSymbol, mintable0, mintable1, mintable2, maxReserves, maxReservesIncreaseRateQ96, 
        assetParams0, assetParams1, assetParams2, setMaxReservesTimestamp, poolMathWrapper, assetParamsNoMintable0, 
        assetParamsNoMintable1, assetParamsNoMintable2, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96 
      } = await loadFixture(deployAll)
    })

    it("remove an asset during normal allocation change", async function() {
      const {
        indexToken, liquidityPool, liquidityPool0, liquidityPool1, liquidityPool2, liquidityPool3, liquidityPool4, 
        admin, unpriviledged, tokenName, tokenSymbol, mintable0, mintable1, mintable2, maxReserves, maxReservesIncreaseRateQ96, 
        assetParams0, assetParams1, assetParams2, setMaxReservesTimestamp, poolMathWrapper, assetParamsNoMintable0, 
        assetParamsNoMintable1, assetParamsNoMintable2, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96 
      } = await loadFixture(deployAll)
    })

    it("normal allocation change while adding an asset", async function() {
      const {
        indexToken, liquidityPool, liquidityPool0, liquidityPool1, liquidityPool2, liquidityPool3, liquidityPool4, 
        admin, unpriviledged, tokenName, tokenSymbol, mintable0, mintable1, mintable2, maxReserves, maxReservesIncreaseRateQ96, 
        assetParams0, assetParams1, assetParams2, setMaxReservesTimestamp, poolMathWrapper, assetParamsNoMintable0, 
        assetParamsNoMintable1, assetParamsNoMintable2, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96 
      } = await loadFixture(deployAll)
    })

    it("normal allocation change while removing an asset", async function() {
      const {
        indexToken, liquidityPool, liquidityPool0, liquidityPool1, liquidityPool2, liquidityPool3, liquidityPool4, 
        admin, unpriviledged, tokenName, tokenSymbol, mintable0, mintable1, mintable2, maxReserves, maxReservesIncreaseRateQ96, 
        assetParams0, assetParams1, assetParams2, setMaxReservesTimestamp, poolMathWrapper, assetParamsNoMintable0, 
        assetParamsNoMintable1, assetParamsNoMintable2, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96 
      } = await loadFixture(deployAll)
    })

    it("add an asset while adding an asset", async function() {
      const {
        indexToken, liquidityPool, liquidityPool0, liquidityPool1, liquidityPool2, liquidityPool3, liquidityPool4, 
        admin, unpriviledged, tokenName, tokenSymbol, mintable0, mintable1, mintable2, maxReserves, maxReservesIncreaseRateQ96, 
        assetParams0, assetParams1, assetParams2, setMaxReservesTimestamp, poolMathWrapper, assetParamsNoMintable0, 
        assetParamsNoMintable1, assetParamsNoMintable2, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96 
      } = await loadFixture(deployAll)
    })

    it("add an asset while removing an asset", async function() {
      const {
        indexToken, liquidityPool, liquidityPool0, liquidityPool1, liquidityPool2, liquidityPool3, liquidityPool4, 
        admin, unpriviledged, tokenName, tokenSymbol, mintable0, mintable1, mintable2, maxReserves, maxReservesIncreaseRateQ96, 
        assetParams0, assetParams1, assetParams2, setMaxReservesTimestamp, poolMathWrapper, assetParamsNoMintable0, 
        assetParamsNoMintable1, assetParamsNoMintable2, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96 
      } = await loadFixture(deployAll)
    })

    it("remove an asset while adding an asset", async function() {
      const {
        indexToken, liquidityPool, liquidityPool0, liquidityPool1, liquidityPool2, liquidityPool3, liquidityPool4, 
        admin, unpriviledged, tokenName, tokenSymbol, mintable0, mintable1, mintable2, maxReserves, maxReservesIncreaseRateQ96, 
        assetParams0, assetParams1, assetParams2, setMaxReservesTimestamp, poolMathWrapper, assetParamsNoMintable0, 
        assetParamsNoMintable1, assetParamsNoMintable2, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96 
      } = await loadFixture(deployAll)
    })

    it("remove an asset while removing an asset", async function() {
      const {
        indexToken, liquidityPool, liquidityPool0, liquidityPool1, liquidityPool2, liquidityPool3, liquidityPool4, 
        admin, unpriviledged, tokenName, tokenSymbol, mintable0, mintable1, mintable2, maxReserves, maxReservesIncreaseRateQ96, 
        assetParams0, assetParams1, assetParams2, setMaxReservesTimestamp, poolMathWrapper, assetParamsNoMintable0, 
        assetParamsNoMintable1, assetParamsNoMintable2, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96 
      } = await loadFixture(deployAll)
    })
  })
})