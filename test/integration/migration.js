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
      assetParamsNoMintable1, assetParamsNoMintable2, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96,
      liquidityPoolHelpers, liquidityPoolHelpers0, liquidityPoolHelpers1, liquidityPoolHelpers2, liquidityPoolHelpers3, liquidityPoolHelpers4,
    } = await loadFixture(deployAll)
    const balance0Initial = await mintable0.balanceOf(admin)
    const balance1Initial = await mintable1.balanceOf(admin)
    const balance2Initial = await mintable2.balanceOf(admin)
    await liquidityPool.setMintFeeQ96(0)
    const mintAmount = 1_000_000_000n
    await liquidityPool.mint(utils.scale10Pow18(mintAmount), "0x")
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
    const migrationStartingBalance = await indexToken.balanceOf(admin)
    const migrationStartingTotalSupply = await indexToken.totalSupply()
    await increaseTime(Number(minBalanceMultiplierChangeDelay) + 1)

    //expect balance and total supply to tick down
    const midMigrationBalance = await indexToken.balanceOf(admin)
    const midMigrationTotalSupply = await indexToken.totalSupply()
    expect(midMigrationBalance).to.be.closeTo((migrationStartingBalance << 96n) / maxBalanceMultiplierChangePerSecondQ96, midMigrationBalance / 1_000_000_000_000n)
    expect(midMigrationTotalSupply).to.be.closeTo((migrationStartingTotalSupply << 96n) / maxBalanceMultiplierChangePerSecondQ96, midMigrationTotalSupply / 1_000_000_000n)

    //expect conversion rate to tick up at the same rate as balance ticks down
    await increaseTime(69)
    const balance0Before = await mintable0.balanceOf(admin)
    const balance1Before = await mintable1.balanceOf(admin)
    const balance2Before = await mintable2.balanceOf(admin)
    await liquidityPoolHelpers.burnAll();
    const balance0After = await mintable0.balanceOf(admin)
    const balance1After = await mintable1.balanceOf(admin)
    const balance2After = await mintable2.balanceOf(admin)
    const migratingAmount0Received = balance0After - balance0Before
    const migratingAmount1Received = balance1After - balance1Before
    const migratingAmount2Received = balance2After - balance2Before
    expect(migratingAmount0Received).to.be.closeTo(initialAmount0Paid, initialAmount0Paid / 1_000_000_000n)
    expect(migratingAmount1Received).to.be.closeTo(initialAmount1Paid, initialAmount1Paid / 1_000_000_000n)
    expect(migratingAmount2Received).to.be.closeTo(initialAmount2Paid, initialAmount2Paid / 1_000_000_000n)
    {
      // new liquidity pool must be configured properly before minting is allowed
      await liquidityPool0.mint(utils.scale10Pow18(mintAmount), "0x")
      expect(await mintable0.balanceOf(liquidityPool0)).not.to.equal(0n)
      expect(await mintable1.balanceOf(liquidityPool0)).not.to.equal(0n)
      expect(await mintable2.balanceOf(liquidityPool0)).not.to.equal(0n)
    }

    const preWithdrawalLiquidityPoolBalance0 = await mintable0.balanceOf(liquidityPool)
    const preWithdrawalLiquidityPoolBalance1 = await mintable1.balanceOf(liquidityPool)
    const preWithdrawalLiquidityPoolBalance2 = await mintable2.balanceOf(liquidityPool)
    const preWithdrawalCallerBalance0 = await mintable0.balanceOf(admin)
    const preWithdrawalCallerBalance1 = await mintable1.balanceOf(admin)
    const preWithdrawalCallerBalance2 = await mintable2.balanceOf(admin)
    await liquidityPool.withdrawAll()
    const postWithdrawalCallerBalance0 = await mintable0.balanceOf(admin)
    const postWithdrawalCallerBalance1 = await mintable1.balanceOf(admin)
    const postWithdrawalCallerBalance2 = await mintable2.balanceOf(admin)
    expect(postWithdrawalCallerBalance0).to.equal(preWithdrawalCallerBalance0 + preWithdrawalLiquidityPoolBalance0)
    expect(postWithdrawalCallerBalance1).to.equal(preWithdrawalCallerBalance1 + preWithdrawalLiquidityPoolBalance1)
    expect(postWithdrawalCallerBalance2).to.equal(preWithdrawalCallerBalance2 + preWithdrawalLiquidityPoolBalance2)
    var totalReserves = await liquidityPool0.getTotalReservesScaled()
    var totalSupply = await indexToken.totalSupply()
    console.log("reserves:", totalReserves)
    console.log("supply  :", totalSupply)
    expect(totalReserves).to.be.greaterThanOrEqual(totalSupply)
    await liquidityPool.finishEmigration()
    totalReserves = await liquidityPool0.getTotalReservesScaled()
    totalSupply = await indexToken.totalSupply()
    console.log("reserves:", totalReserves)
    console.log("supply  :", totalSupply)
    expect(totalReserves).to.be.greaterThanOrEqual(totalSupply)  })

  it("multiple migrations", async function() {
    const deployParams = await loadFixture(deployAll)
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