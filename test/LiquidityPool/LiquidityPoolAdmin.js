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

describe("LiquidityPool - Admin Functions", function() {
  describe("setAdmin", function() {
    it("sets new admin and emits event when called by admin", async function() {
      const { liquidityPool, admin, unpriviledged } = await loadFixture(deployAll);
      await expect(liquidityPool.connect(admin).setAdmin(unpriviledged.address))
        .to.emit(liquidityPool, "AdminChange").withArgs(unpriviledged.address);
      expect(await liquidityPool.getAdmin()).to.equal(unpriviledged.address);
    });
    it("reverts when called by non-admin", async function() {
      const { liquidityPool, unpriviledged, admin } = await loadFixture(deployAll);
      await expect(liquidityPool.connect(unpriviledged).setAdmin(admin.address))
        .to.be.revertedWith("only_admin");
    });
  });

  describe("setMintFeeQ96", function() {
    it("sets new mint fee and emits event when called by admin", async function() {
      const { liquidityPool, admin } = await loadFixture(deployAll);
      const newFee = utils.decimalToFixed(0.02);
      await expect(liquidityPool.connect(admin).setMintFeeQ96(newFee))
        .to.emit(liquidityPool, "MintFeeChange").withArgs(newFee);
      expect(await liquidityPool.getMintFeeQ96()).to.equal(newFee);
    });
    it("reverts when called by non-admin", async function() {
      const { liquidityPool, unpriviledged } = await loadFixture(deployAll);
      const newFee = utils.decimalToFixed(0.02);
      await expect(liquidityPool.connect(unpriviledged).setMintFeeQ96(newFee))
        .to.be.revertedWith("only_admin");
    });
  });

  describe("setBurnFeeQ96", function() {
    it("sets new burn fee and emits event when called by admin", async function() {
      const { liquidityPool, admin } = await loadFixture(deployAll);
      const newFee = utils.decimalToFixed(0.03);
      await expect(liquidityPool.connect(admin).setBurnFeeQ96(newFee))
        .to.emit(liquidityPool, "BurnFeeChange").withArgs(newFee);
      expect(await liquidityPool.getBurnFeeQ96()).to.equal(newFee);
    });
    it("reverts when called by non-admin", async function() {
      const { liquidityPool, unpriviledged } = await loadFixture(deployAll);
      const newFee = utils.decimalToFixed(0.03);
      await expect(liquidityPool.connect(unpriviledged).setBurnFeeQ96(newFee))
        .to.be.revertedWith("only_admin");
    });
  });

  describe("setMaxReservesIncreaseCooldown", function() {
    it("sets new cooldown and emits event when called by admin", async function() {
      const { liquidityPool, admin } = await loadFixture(deployAll);
      const newCooldown = 12345;
      await expect(liquidityPool.connect(admin).setMaxReservesIncreaseCooldown(newCooldown))
        .to.emit(liquidityPool, "MaxReservesIncreaseCooldownChange").withArgs(newCooldown);
      expect(await liquidityPool.getMaxReservesIncreaseCooldown()).to.equal(newCooldown);
    });
    it("reverts when called by non-admin", async function() {
      const { liquidityPool, unpriviledged } = await loadFixture(deployAll);
      const newCooldown = 12345;
      await expect(liquidityPool.connect(unpriviledged).setMaxReservesIncreaseCooldown(newCooldown))
        .to.be.revertedWith("only_admin");
    });
  });

  describe("setMaxReservesIncreaseRateQ96", function() {
    it("sets new rate and emits event when called by admin", async function() {
      const { liquidityPool, admin } = await loadFixture(deployAll);
      const newRate = utils.decimalToFixed(0.2);
      await expect(liquidityPool.connect(admin).setMaxReservesIncreaseRateQ96(newRate))
        .to.emit(liquidityPool, "MaxReservesIncreaseRateChange").withArgs(newRate);
      expect(await liquidityPool.getMaxReservesIncreaseRateQ96()).to.equal(newRate);
    });
    it("reverts when called by non-admin", async function() {
      const { liquidityPool, unpriviledged } = await loadFixture(deployAll);
      const newRate = utils.decimalToFixed(0.2);
      await expect(liquidityPool.connect(unpriviledged).setMaxReservesIncreaseRateQ96(newRate))
        .to.be.revertedWith("only_admin");
    });
  });

  describe("setMaxReserves", function() {
    it("sets new max reserves, emits event, and updates timestamp when called by admin", async function() {
      const { liquidityPool, admin } = await loadFixture(deployAll);
      const newMax = 123456789n;
      const tx = await liquidityPool.connect(admin).setMaxReserves(newMax);
      const block0 = await hre.ethers.provider.getBlock(tx.blockNumber);
      await expect(tx).to.emit(liquidityPool, "MaxReservesChange").withArgs(newMax, block0.timestamp);
      expect(await liquidityPool.getMaxReserves()).to.equal(newMax);
      const block1 = await hre.ethers.provider.getBlock(tx.blockNumber);
      expect(await liquidityPool.getLastMaxReservesChangeTimestamp()).to.equal(block1.timestamp);
    });
    it("reverts when called by non-admin", async function() {
      const { liquidityPool, unpriviledged } = await loadFixture(deployAll);
      const newMax = 123456789n;
      await expect(liquidityPool.connect(unpriviledged).setMaxReserves(newMax))
        .to.be.revertedWith("only_admin");
    });
  });

  describe("setTargetAssetParams", function() {
    it("sets new asset params and emits event(s) when called by admin", async function() {
      const { liquidityPool, admin, mintable0, mintable1, mintable2 } = await loadFixture(deployAll);
      const params0 = [
        { assetAddress: mintable0.target, targetAllocation: utils.formatAllocationFromDecimal(0.5), decimals: 18n },
        { assetAddress: mintable1.target, targetAllocation: utils.formatAllocationFromDecimal(0.2), decimals: 20n },
        { assetAddress: mintable2.target, targetAllocation: utils.formatAllocationFromDecimal(0.1), decimals: 6n },
        { assetAddress: "0x4838B106FCe9647Bdf1E7877BF73cE8B0BAD5f97", targetAllocation: (2n ** 88n - 1n) - utils.formatAllocationFromDecimal(0.5) - utils.formatAllocationFromDecimal(0.2) - utils.formatAllocationFromDecimal(0.1), decimals: 6n }
      ];
      const params1 = [
        { assetAddress: mintable0.target, targetAllocation: utils.formatAllocationFromDecimal(0.5), decimals: 18n },
        { assetAddress: mintable1.target, targetAllocation: utils.formatAllocationFromDecimal(0.3), decimals: 20n },
        { assetAddress: mintable2.target, targetAllocation: (2n ** 88n - 1n) - utils.formatAllocationFromDecimal(0.5) - utils.formatAllocationFromDecimal(0.3), decimals: 6n },
      ];
      await expect(liquidityPool.connect(admin).setTargetAssetParams(params0))
        .to.emit(liquidityPool, "TargetAssetParamsChange");
      await liquidityPool.connect(admin).setTargetAssetParams(params1)
      const result = await liquidityPool.getTargetAssetParams()
      result.forEach((p, i) => {
        expect(p[0]).to.equal(params1[i].assetAddress, `failed check on index ${i}`)
        expect(p[1]).to.equal(params1[i].targetAllocation, `failed check on index ${i}`)
        expect(p[2]).to.equal(params1[i].decimals, `failed check on index ${i}`)
      })
      const resultCurrent = await liquidityPool.getCurrentAssetParams()
      await Promise.all(resultCurrent.map(async (p, i) => {
        if(i == 3) {
          expect(p[0]).to.equal(params0[i].assetAddress, `failed check on index ${i}`)
          expect(p[1]).to.equal(0n, `failed check on index ${i}`)
          expect(p[2]).to.equal(params0[i].decimals, `failed check on index ${i}`)
          //expect the assetParams map to be consistent with the currentAssetParamsList
          const mapResult = await liquidityPool.getAssetParams(p[0])
          expect(mapResult[0]).to.equal(params0[i].assetAddress, `failed check on index ${i}`)
          expect(mapResult[1]).to.equal(0n, `failed check on index ${i}`)
          expect(mapResult[2]).to.equal(params0[i].decimals, `failed check on index ${i}`)
          return
        }
        expect(p[0]).to.equal(params1[i].assetAddress, `failed check on index ${i}`)
        expect(p[1]).to.equal(params1[i].targetAllocation, `failed check on index ${i}`)
        expect(p[2]).to.equal(params1[i].decimals, `failed check on index ${i}`)
        //expect the assetParams map to be consistent with the currentAssetParamsList
        const mapResult = await liquidityPool.getAssetParams(p[0])
        expect(mapResult[0]).to.equal(params1[i].assetAddress, `failed check on index ${i}`)
        expect(mapResult[1]).to.equal(params1[i].targetAllocation, `failed check on index ${i}`)
        expect(mapResult[2]).to.equal(params1[i].decimals, `failed check on index ${i}`)
      }))
    });
    it("reverts if total target allocation is above 1", async function() {
      const { liquidityPool, admin, mintable0, mintable1, mintable2 } = await loadFixture(deployAll);
      const params = [
        { assetAddress: mintable0.target, targetAllocation: utils.formatAllocationFromDecimal(0.3), decimals: 18n },
        { assetAddress: mintable1.target, targetAllocation: utils.formatAllocationFromDecimal(0.5), decimals: 20n },
        { assetAddress: mintable2.target, targetAllocation: (2n ** 88n - 1n) - utils.formatAllocationFromDecimal(0.5) - utils.formatAllocationFromDecimal(0.3) + 1n, decimals: 6n }
      ];
      await expect(
        liquidityPool.connect(admin).setTargetAssetParams(params)
      ).to.be.revertedWithPanic("0x11"); // Arithmetic operation underflowed or overflowed outside of an unchecked block
    });
    it("reverts if total allocation is below 1", async function() {
      const { liquidityPool, admin, mintable0, mintable1, mintable2 } = await loadFixture(deployAll);
      const params = [
        { assetAddress: mintable0.target, targetAllocation: utils.formatAllocationFromDecimal(0.3), decimals: 18n },
        { assetAddress: mintable1.target, targetAllocation: utils.formatAllocationFromDecimal(0.5), decimals: 20n },
        { assetAddress: mintable2.target, targetAllocation: (2n ** 88n - 1n) - utils.formatAllocationFromDecimal(0.5) - utils.formatAllocationFromDecimal(0.3) - 1n, decimals: 6n }
      ];
      await expect(
        liquidityPool.connect(admin).setTargetAssetParams(params)
      ).to.be.revertedWith("total target allocation must be 1");
    });
    it("reverts when called by non-admin", async function() {
      const { liquidityPool, unpriviledged, mintable0, mintable1, mintable2 } = await loadFixture(deployAll);
      const params = [
        { assetAddress: mintable0.target, targetAllocation: utils.formatAllocationFromDecimal(0.5), decimals: 18n },
        { assetAddress: mintable1.target, targetAllocation: utils.formatAllocationFromDecimal(0.3), decimals: 20n },
        { assetAddress: mintable2.target, targetAllocation: (2n ** 88n - 1n) - utils.formatAllocationFromDecimal(0.5) - utils.formatAllocationFromDecimal(0.3), decimals: 6n }
      ];
      await expect(liquidityPool.connect(unpriviledged).setTargetAssetParams(params))
        .to.be.revertedWith("only_admin");
    });
  });

  describe("withdrawFees", function() {
    it("withdraws fees and emits event when called by admin", async function() {
      const { liquidityPool, indexToken, admin, unpriviledged } = await loadFixture(deployAll);
      const feeRecipient = unpriviledged.address;
      const initialBalance = await indexToken.balanceOf(feeRecipient);
      await liquidityPool.connect(admin).mint(utils.scale10Pow18(1_000_000n), "0x");
      const adminBal = await indexToken.balanceOf(admin.address)
      const feesAvailable = await liquidityPool.getFeesCollected();
      await expect(liquidityPool.connect(admin).withdrawFees(feeRecipient))
        .to.emit(liquidityPool, "FeesCollected");
      const finalBalance = await indexToken.balanceOf(feeRecipient);
      expect(finalBalance - initialBalance).to.equal(feesAvailable);
      expect(await liquidityPool.getFeesCollected()).to.equal(0n);
    });
    
    it("reverts when called by non-admin", async function() {
      const { liquidityPool, unpriviledged } = await loadFixture(deployAll);
      await expect(liquidityPool.connect(unpriviledged).withdrawFees(unpriviledged.address))
        .to.be.revertedWith("only_admin");
    });
  });

  describe("setIsMintEnabled", function() {
    it("sets mint enabled and emits event when called by admin", async function() {
      const { liquidityPool, admin } = await loadFixture(deployAll);
      await expect(liquidityPool.connect(admin).setIsMintEnabled(false))
        .to.emit(liquidityPool, "IsMintEnabledChange").withArgs(false);
      expect(await liquidityPool.getIsMintEnabled()).to.equal(false);
    });

    it("reverts when called by non-admin", async function() {
      const { liquidityPool, unpriviledged } = await loadFixture(deployAll);
      await expect(liquidityPool.connect(unpriviledged).setIsMintEnabled(true))
        .to.be.revertedWith("only_admin");
    });
  });

  describe("increaseEqualizationBounty", function() {
    it("should fail if the pool doesn't have enough fees collected", async function() {
      const { liquidityPool, indexToken, admin, unpriviledged } = await loadFixture(deployAll);
      const feesCollected = await liquidityPool.getFeesCollected()
      await expect(
        liquidityPool.increaseEqualizationBounty(feesCollected + 1n)
      ).to.be.revertedWith("not enough tokens to cover bounty");
    })

    it("should fail in the case that the balance is greater than the bounty increase, but fees collected are not", async function () {
      const { liquidityPool, indexToken, admin, unpriviledged } = await loadFixture(deployAll);
      await liquidityPool.setMintFeeQ96(0n)
      await liquidityPool.mint(1000000n, "0x")
      await indexToken.transfer(liquidityPool, 42069n)
      await liquidityPool.increaseEqualizationBounty(69n)
      const bountyIncrease = 42001n
      const poolBalance = await indexToken.balanceOf(liquidityPool)
      expect(bountyIncrease).to.be.lessThan(poolBalance)
      await expect(
        liquidityPool.increaseEqualizationBounty(bountyIncrease)
      ).to.be.revertedWith("not enough tokens to cover bounty")
    })

    it("should add the equalization bounty to the previous equalization bounty", async function () {
      const { liquidityPool, indexToken, admin, unpriviledged } = await loadFixture(deployAll);
      await liquidityPool.setMintFeeQ96(0n)
      await liquidityPool.mint(1000000n, "0x")
      const totalFees = 42069n
      await indexToken.transfer(liquidityPool, totalFees)
      const initialBounty = 69n
      await liquidityPool.increaseEqualizationBounty(initialBounty)
      const secondBounty = 42000n
      await liquidityPool.increaseEqualizationBounty(secondBounty)
      expect(await liquidityPool.getEqualizationBounty()).to.equal(initialBounty + secondBounty)
    })
  })

  describe("startEmigration", function() {
    it("should fail if the pool is already migrating", async function() {
      const { liquidityPool, indexToken, liquidityPool0, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96 } = await loadFixture(deployAll)
      await liquidityPool.startEmigration(
        liquidityPool0, 
        minBalanceMultiplierChangeDelay,
        maxBalanceMultiplierChangePerSecondQ96,
      )
      await expect(
        liquidityPool.startEmigration(
        liquidityPool0, 
        minBalanceMultiplierChangeDelay,
        maxBalanceMultiplierChangePerSecondQ96,
        )
      ).to.be.revertedWith("liquidityPool is migrating")
    })

    it("should set all of the relevant variables", async function() {
      const { liquidityPool, indexToken, liquidityPool0, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96 } = await loadFixture(deployAll)
      
      await liquidityPool.startEmigration(
        liquidityPool0, 
        minBalanceMultiplierChangeDelay,
        maxBalanceMultiplierChangePerSecondQ96,
      )
      const block0 = await hre.ethers.provider.getBlock("latest")
      expect(await indexToken.isMigrating()).to.equal(true)
      expect(await liquidityPool.isEmigrating()).to.equal(true)
      expect(await indexToken.getNextLiquidityPool()).to.equal(liquidityPool0)
      expect(await indexToken.getMigrationStartTimestamp()).to.equal(block0.timestamp)
      expect(await indexToken.getBalanceMultiplierChangeDelay()).to.equal(minBalanceMultiplierChangeDelay)
      expect(await indexToken.getBalanceMultiplierChangePerSecondQ96()).to.equal(maxBalanceMultiplierChangePerSecondQ96)
    })
  })

  describe("finishEmigration", function() {
    it("should fail if the pool is not currently migrating", async function() {
      const { liquidityPool, indexToken, liquidityPool0, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96 } = await loadFixture(deployAll)
      await expect(liquidityPool.finishEmigration()).to.be.revertedWith("liquidity pool not migrating")
    })

    it("should fail if there are still reserves in the pool", async function() {
      const { liquidityPool, indexToken, liquidityPool0, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96 } = await loadFixture(deployAll)
      await liquidityPool.mint(1000n, "0x")
      await liquidityPool.startEmigration(
        liquidityPool0, 
        minBalanceMultiplierChangeDelay,
        maxBalanceMultiplierChangePerSecondQ96,
      )

      await expect(liquidityPool.finishEmigration()).to.be.revertedWith("cannot finish emigration until all reserves have been moved")
    })

    it("should set all of the relevant variables", async function() {
      const { liquidityPool, indexToken, liquidityPool0, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96 } = await loadFixture(deployAll)
      await liquidityPool.startEmigration(
        liquidityPool0, 
        minBalanceMultiplierChangeDelay,
        maxBalanceMultiplierChangePerSecondQ96,
      )

      await increaseTime(Number(minBalanceMultiplierChangeDelay * 2n))
      await liquidityPool.finishEmigration()

      expect(await indexToken.balanceOf(liquidityPool)).to.equal(0n, "old liquidity pool should have burnt all its reserves")
      expect(await liquidityPool.isEmigrating()).to.equal(false)
      expect(await indexToken.isMigrating()).to.equal(false)
      expect(await indexToken.getNextLiquidityPool()).to.equal(hre.ethers.ZeroAddress)
    })
  })
});