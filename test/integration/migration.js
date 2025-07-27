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
  it.only("normal migration - test that everything is as expected throughout the migration lifecycle", async function() {
    const {
      indexToken, liquidityPool, liquidityPool0, liquidityPool1, liquidityPool2, liquidityPool3, liquidityPool4, 
      admin, unpriviledged, tokenName, tokenSymbol, mintable0, mintable1, mintable2, maxReserves, maxReservesIncreaseRateQ96, 
      assetParams0, assetParams1, assetParams2, setMaxReservesTimestamp, poolMathWrapper, assetParamsNoMintable0, 
      assetParamsNoMintable1, assetParamsNoMintable2, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96 
    } = await loadFixture(deployAll)
    const balance0Initial = await mintable0.balanceOf(admin)
    const balance1Initial = await mintable1.balanceOf(admin)
    const balance2Initial = await mintable2.balanceOf(admin)
    await liquidityPool.mint(utils.scale10Pow18(1_000_000n), "0x")
    const balance0PostMint = await mintable0.balanceOf(admin)
    const balance1PostMint = await mintable1.balanceOf(admin)
    const balance2PostMint = await mintable2.balanceOf(admin)
    const initialAmount0Paid = balance0Initial - balance0PostMint
    const initialAmount1Paid = balance1Initial - balance1PostMint
    const initialAmount2Paid = balance2Initial - balance2PostMint

    await liquidityPool.startEmigration(
      liquidityPool0,
      minBalanceMultiplierChangeDelay,
      maxBalanceMultiplierChangePerSecondQ96
    )
    await liquidityPool0.connect(unpriviledged).mint(utils.scale10Pow18(1_000_000n), "0x")
    const migrationStartingBalance = await indexToken.balanceOf(admin)
    const migrationStartingTotalSupply = await indexToken.totalSupply()
    await increaseTime(Number(minBalanceMultiplierChangeDelay))

    //expect balance and total supply to tick down
    const midMigrationBalance = await indexToken.balanceOf(admin)
    const midMigrationTotalSupply = await indexToken.totalSupply()
    expect(midMigrationBalance).to.be.closeTo((migrationStartingBalance << 96n) / maxBalanceMultiplierChangePerSecondQ96, midMigrationBalance / 1_000_000_000_000n)
    expect(midMigrationTotalSupply).to.be.closeTo((migrationStartingTotalSupply << 96n) / maxBalanceMultiplierChangePerSecondQ96, midMigrationTotalSupply / 1_000_000_000n)

    //expect conversion rate to tick up at the same rate as balance ticks down
    const balance0Before = await mintable0.balanceOf(admin)
    const balance1Before = await mintable1.balanceOf(admin)
    const balance2Before = await mintable2.balanceOf(admin)
    const totalScaledReservesBefore = await liquidityPool.totaReservesScaled()
    await liquidityPool.burn(await indexToken.balanceOf(admin), "0x")
    const balance0After = await mintable0.balanceOf(admin)
    const balance1After = await mintable1.balanceOf(admin)
    const balance2After = await mintable2.balanceOf(admin)
    const migratingAmount0Received = balance0After - balance0Before
    const migratingAmount1Received = balance1After - balance1Before
    const migratingAmount2Received = balance2After - balance2Before
    expect(migratingAmount0Received).to.equal(initialAmount0Paid -1n)
    expect(migratingAmount1Received).to.equal(initialAmount1Paid - 1n)
    expect(migratingAmount2Received).to.equal(initialAmount2Paid - 1n)    

    await liquidityPool.withdrawAll()
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