const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const hre = require("hardhat");
const utils = require("./testModules/utils");

const DEFAULT_BALANCE_MULTIPLIER = 2n ** 48n - 1n

async function deployIndex() {
  const [reserveManager, nextReserveManager, unprivileged0] = await hre.ethers.getSigners()
  const tokenName = "Diversified USD";
  const tokenSymbol = "USD1";
  const minbalanceDivisorChangeDelay = 100n
  const maxbalanceDivisorChangePerSecondQ96 = utils.decimalToFixed(1.001)
  const indexToken = await hre.ethers.deployContract("IndexToken", [
    tokenName,
    tokenSymbol,
    reserveManager.address,
    minbalanceDivisorChangeDelay,
    maxbalanceDivisorChangePerSecondQ96
  ]);
  const startingTotalSupply = utils.scale10Pow18(1_000_000n)
  await indexToken.mint(reserveManager.address, startingTotalSupply)
  return { indexToken, reserveManager, nextReserveManager, minbalanceDivisorChangeDelay, maxbalanceDivisorChangePerSecondQ96, unprivileged0, startingTotalSupply }
}

async function increaseTime(seconds) {
  await ethers.provider.send("evm_increaseTime", [seconds]);

  // Mine a new block so the increased time takes effect
  await ethers.provider.send("evm_mine", []);
}

describe("IndexToken", function() {
  describe("Special Functionality", function() {
    describe("isMigrating", function() {
      it("returns false if not migrating", async function() {
        const { indexToken } = await loadFixture(deployIndex)
        expect(await indexToken.isMigrating()).to.equal(false)
      })

      it("returns true if migrating", async function() {
        const { 
          indexToken,
          nextReserveManager, 
          minbalanceDivisorChangeDelay, 
          maxbalanceDivisorChangePerSecondQ96 
        } = await loadFixture(deployIndex)
        await indexToken.startMigration(
          nextReserveManager, 
          minbalanceDivisorChangeDelay, 
          maxbalanceDivisorChangePerSecondQ96
        )
        expect(await indexToken.isMigrating()).to.equal(true)

      })
    })

    describe("getNextReserveManager", function() {
      it("returns 0 address if not migrating", async function() {
        const { indexToken, reserveManager, nextReserveManager, minbalanceDivisorChangeDelay, maxbalanceDivisorChangePerSecondQ96 } = await loadFixture(deployIndex)
        expect(await indexToken.getNextReserveManager()).to.equal(hre.ethers.ZeroAddress)
      })

      it("returns next address if migrating", async function() {
        const { indexToken, reserveManager, nextReserveManager, minbalanceDivisorChangeDelay, maxbalanceDivisorChangePerSecondQ96 } = await loadFixture(deployIndex)
        await indexToken.startMigration(
          nextReserveManager, 
          minbalanceDivisorChangeDelay, 
          maxbalanceDivisorChangePerSecondQ96
        )
        expect(await indexToken.getNextReserveManager()).to.equal(nextReserveManager)
      })
    })

    describe("getlastBalanceDivisor", function() {
      it("returns last balance multiplier", async function() {
        const { indexToken, reserveManager, nextReserveManager, minbalanceDivisorChangeDelay, maxbalanceDivisorChangePerSecondQ96 } = await loadFixture(deployIndex)
        expect(await indexToken.getlastBalanceDivisor()).to.equal(DEFAULT_BALANCE_MULTIPLIER)
      })
    })

    describe("getMigrationStartTimestamp", function() {
      it("returns the start timestamp that the migration started", async function() {
        const { indexToken, reserveManager, nextReserveManager, minbalanceDivisorChangeDelay, maxbalanceDivisorChangePerSecondQ96 } = await loadFixture(deployIndex)
        await indexToken.startMigration(
          nextReserveManager, 
          minbalanceDivisorChangeDelay, 
          maxbalanceDivisorChangePerSecondQ96
        )
        const latestBlock = await ethers.provider.getBlock("latest");
        expect(await indexToken.getMigrationStartTimestamp()).to.equal(latestBlock.timestamp)
      })
    })

    describe("getBalanceDivisorChangeDelay", function() {
      it("should return the change delay", async function() {
        const { indexToken, reserveManager, nextReserveManager, minbalanceDivisorChangeDelay, maxbalanceDivisorChangePerSecondQ96 } = await loadFixture(deployIndex)
        await indexToken.startMigration(
          nextReserveManager, 
          minbalanceDivisorChangeDelay, 
          maxbalanceDivisorChangePerSecondQ96
        )
        expect(await indexToken.getBalanceDivisorChangeDelay()).to.equal(minbalanceDivisorChangeDelay)
      })
    })

    describe("getBalanceDivisorChangePerSecondQ96", function() {
      it("returns the balance multiplier change per second set when the migration started", async function() {
        const { indexToken, reserveManager, nextReserveManager, minbalanceDivisorChangeDelay, maxbalanceDivisorChangePerSecondQ96 } = await loadFixture(deployIndex)
        await indexToken.startMigration(
          nextReserveManager, 
          minbalanceDivisorChangeDelay, 
          maxbalanceDivisorChangePerSecondQ96
        )
        expect(await indexToken.getBalanceDivisorChangePerSecondQ96()).to.equal(maxbalanceDivisorChangePerSecondQ96)
      })
    })

    describe("getReserveManager", function() {
      it("returns the current liquidity pool", async function() {
        const { indexToken, reserveManager, nextReserveManager, minbalanceDivisorChangeDelay, maxbalanceDivisorChangePerSecondQ96, unprivileged0, startingTotalSupply } = await loadFixture(deployIndex)
        expect(await indexToken.getReserveManager()).to.equal(reserveManager)
      })
    })

    describe("startMigration", function() {
      it("should not be callable by non-admin address", async function() {
        const { indexToken, reserveManager, nextReserveManager, minbalanceDivisorChangeDelay, maxbalanceDivisorChangePerSecondQ96, unprivileged0, startingTotalSupply } = await loadFixture(deployIndex)
        await expect(indexToken.connect(unprivileged0).startMigration(
          nextReserveManager,
          minbalanceDivisorChangeDelay,
          maxbalanceDivisorChangePerSecondQ96
        )).to.be.revertedWith("only reserve manager")
      })

      it("should not be callable if a migration is already happening", async function() {
        const { indexToken, reserveManager, nextReserveManager, minbalanceDivisorChangeDelay, maxbalanceDivisorChangePerSecondQ96, unprivileged0, startingTotalSupply } = await loadFixture(deployIndex)
        await indexToken.startMigration(
          nextReserveManager,
          minbalanceDivisorChangeDelay,
          maxbalanceDivisorChangePerSecondQ96
        )
        await expect(indexToken.startMigration(
          nextReserveManager,
          minbalanceDivisorChangeDelay,
          maxbalanceDivisorChangePerSecondQ96
        )).to.be.revertedWith("reserve manager is migrating")
      })

      it("should fail if the change delay is too below the minimum", async function() {
        const { indexToken, reserveManager, nextReserveManager, minbalanceDivisorChangeDelay, maxbalanceDivisorChangePerSecondQ96, unprivileged0, startingTotalSupply } = await loadFixture(deployIndex)
        await expect(indexToken.startMigration(
          nextReserveManager,
          minbalanceDivisorChangeDelay -1n,
          maxbalanceDivisorChangePerSecondQ96
        )).to.be.revertedWith("balance divisor change delay too short")
      })

      it("should fail if the balance multiplier change per second is greater than the max rate", async function() {
        const { indexToken, reserveManager, nextReserveManager, minbalanceDivisorChangeDelay, maxbalanceDivisorChangePerSecondQ96, unprivileged0, startingTotalSupply } = await loadFixture(deployIndex)
        await expect(indexToken.startMigration(
          nextReserveManager,
          minbalanceDivisorChangeDelay,
          maxbalanceDivisorChangePerSecondQ96 + 1n
        )).to.be.revertedWith("balance divisor change rate too high")
      })

      it("should set the relevant variables", async function() {
        const { indexToken, reserveManager, nextReserveManager, minbalanceDivisorChangeDelay, maxbalanceDivisorChangePerSecondQ96, unprivileged0, startingTotalSupply } = await loadFixture(deployIndex)
        await indexToken.startMigration(
          nextReserveManager,
          minbalanceDivisorChangeDelay,
          maxbalanceDivisorChangePerSecondQ96
        )
        const latestBlock = await ethers.provider.getBlock("latest");
        expect(await indexToken.getNextReserveManager()).to.equal(nextReserveManager)
        expect(await indexToken.getMigrationStartTimestamp()).to.equal(latestBlock.timestamp)
        expect(await indexToken.getBalanceDivisorChangeDelay()).to.equal(minbalanceDivisorChangeDelay)
        expect(await indexToken.getBalanceDivisorChangePerSecondQ96()).to.equal(maxbalanceDivisorChangePerSecondQ96)
      })
    })

    describe("finishMigration", function() {
      it("should not be callable by a non-admin", async function() {
        const { indexToken, reserveManager, nextReserveManager, minbalanceDivisorChangeDelay, maxbalanceDivisorChangePerSecondQ96, unprivileged0, startingTotalSupply } = await loadFixture(deployIndex)
        await indexToken.startMigration(
          nextReserveManager,
          minbalanceDivisorChangeDelay,
          maxbalanceDivisorChangePerSecondQ96
        )
        await expect(
          indexToken.connect(unprivileged0).finishMigration(startingTotalSupply)
        ).to.be.revertedWith("only reserve manager")
      })

      it("should not be callable if not migrating", async function() {
        const { indexToken, reserveManager, nextReserveManager, minbalanceDivisorChangeDelay, maxbalanceDivisorChangePerSecondQ96, unprivileged0, startingTotalSupply } = await loadFixture(deployIndex)
        await expect(
          indexToken.finishMigration(startingTotalSupply)
        ).to.be.revertedWith("reserve manager not migrating")
      })

      it("should set the relevant variables", async function() {
        const { indexToken, reserveManager, nextReserveManager, minbalanceDivisorChangeDelay, maxbalanceDivisorChangePerSecondQ96, unprivileged0, startingTotalSupply } = await loadFixture(deployIndex)
        await indexToken.startMigration(
          nextReserveManager,
          minbalanceDivisorChangeDelay,
          maxbalanceDivisorChangePerSecondQ96
        )
        const startingbalanceDivisor = await indexToken.balanceDivisor()
        await increaseTime(Number(minbalanceDivisorChangeDelay) + 1)
        const endingbalanceDivisor = await indexToken.balanceDivisor()
        expect(startingbalanceDivisor).to.be.lessThan(endingbalanceDivisor, "balance multiplier did not increase")
        await indexToken.finishMigration(startingTotalSupply - utils.scale10Pow18(1n))
        expect(await indexToken.getReserveManager()).to.equal(nextReserveManager)
        expect(await indexToken.getNextReserveManager()).to.equal(ethers.ZeroAddress)
        expect(await indexToken.isMigrating()).to.equal(false)
        expect(await indexToken.getlastBalanceDivisor()).to.be.greaterThan(startingbalanceDivisor)
      })
    })

    describe("balanceDivisor", function() {
      it("balance multiplier should be static during non-migration", async function() {
        const { indexToken, reserveManager, nextReserveManager, minbalanceDivisorChangeDelay, maxbalanceDivisorChangePerSecondQ96, unprivileged0, startingTotalSupply } = await loadFixture(deployIndex)
        const startingbalanceDivisor = await indexToken.balanceDivisor()
        await increaseTime(Number(minbalanceDivisorChangeDelay) + 100000000000)
        const endingbalanceDivisor = await indexToken.balanceDivisor()
        expect(startingbalanceDivisor).to.equal(endingbalanceDivisor)
      })

      it("balance multiplier should tick down at the correct rate during migration", async function() {
        const { indexToken, reserveManager, nextReserveManager, minbalanceDivisorChangeDelay, maxbalanceDivisorChangePerSecondQ96, unprivileged0, startingTotalSupply } = await loadFixture(deployIndex)
        const startingbalanceDivisor = await indexToken.balanceDivisor()
        await indexToken.startMigration(
          nextReserveManager,
          minbalanceDivisorChangeDelay,
          maxbalanceDivisorChangePerSecondQ96
        )
        await increaseTime(Number(minbalanceDivisorChangeDelay) + 1)
        var endingbalanceDivisor = await indexToken.balanceDivisor()
        var expectedMultiplier = (startingbalanceDivisor * maxbalanceDivisorChangePerSecondQ96) >> 96n
        expect(endingbalanceDivisor).to.equal(expectedMultiplier)
        await increaseTime(1)
        endingbalanceDivisor = await indexToken.balanceDivisor()
        expectedMultiplier = (expectedMultiplier * maxbalanceDivisorChangePerSecondQ96) >> 96n
        expect(endingbalanceDivisor).to.be.closeTo(expectedMultiplier, 1n)
      })

      it("balance multiplier should not tick down during grace period", async function() {
        const { indexToken, reserveManager, nextReserveManager, minbalanceDivisorChangeDelay, maxbalanceDivisorChangePerSecondQ96, unprivileged0, startingTotalSupply } = await loadFixture(deployIndex)
        await indexToken.startMigration(
          nextReserveManager,
          minbalanceDivisorChangeDelay,
          maxbalanceDivisorChangePerSecondQ96
        )
        const startingbalanceDivisor = await indexToken.balanceDivisor()
        await increaseTime(Number(minbalanceDivisorChangeDelay) - 1)
        const endingbalanceDivisor = await indexToken.balanceDivisor()
        expect(startingbalanceDivisor).to.equal(endingbalanceDivisor)
      })
    })
  })

  describe("ERC20 Functionality", function() {
    describe("name", function () {
      it("should return the name", async function () {
        const { indexToken, reserveManager, nextReserveManager, minbalanceDivisorChangeDelay, maxbalanceDivisorChangePerSecondQ96, unprivileged0, startingTotalSupply } = await loadFixture(deployIndex)
        expect(await indexToken.name()).to.equal("Diversified USD");
      });
    });

    describe("symbol", function () {
      it("should return the symbol", async function () {
        const { indexToken, reserveManager, nextReserveManager, minbalanceDivisorChangeDelay, maxbalanceDivisorChangePerSecondQ96, unprivileged0, startingTotalSupply } = await loadFixture(deployIndex)
        expect(await indexToken.symbol()).to.equal("USD1");
      });
    });

    describe("increaseAllowance", function () {
      it("should increase the allowance", async function () {
        const { indexToken, reserveManager, nextReserveManager, minbalanceDivisorChangeDelay, maxbalanceDivisorChangePerSecondQ96, unprivileged0, startingTotalSupply } = await loadFixture(deployIndex)
        const approveAmount = 100n
        await indexToken.approve(unprivileged0.address, approveAmount);
        
        const increaseAmount = 50n
        await indexToken.increaseAllowance(unprivileged0, 50n);
        
        const allowance = await indexToken.allowance(reserveManager, unprivileged0);
        expect(allowance).to.equal(approveAmount + increaseAmount);
      });
    });

    describe("decreaseAllowance", function () {
      it("should decrease the allowance", async function () {
        const { indexToken, reserveManager, nextReserveManager, minbalanceDivisorChangeDelay, maxbalanceDivisorChangePerSecondQ96, unprivileged0, startingTotalSupply } = await loadFixture(deployIndex)
        const approveAmount = 100n
        await indexToken.approve(unprivileged0.address, approveAmount);
        
        const decreaseAmount = 70n
        await indexToken.decreaseAllowance(unprivileged0, 70n);
        
        const allowance = await indexToken.allowance(reserveManager, unprivileged0);
        expect(allowance).to.equal(approveAmount - decreaseAmount);
      });

      it("should revert if trying to decrease allowance below zero", async function () {
        const { indexToken, reserveManager, nextReserveManager, minbalanceDivisorChangeDelay, maxbalanceDivisorChangePerSecondQ96, unprivileged0, startingTotalSupply } = await loadFixture(deployIndex)
        const approveAmount = 100n
        await indexToken.approve(unprivileged0.address, approveAmount);
        
        const decreaseAmount = 101n
        await expect(
          indexToken.decreaseAllowance(unprivileged0, decreaseAmount)
        ).to.be.revertedWith("ERC20: decreased allowance below zero")
      });
    });

    describe("totalSupply", function() {
      it("should return the correct value", async function() {
        const { indexToken, reserveManager, nextReserveManager, minbalanceDivisorChangeDelay, maxbalanceDivisorChangePerSecondQ96, unprivileged0, startingTotalSupply } = await loadFixture(deployIndex)
        expect(await indexToken.totalSupply()).to.equal(startingTotalSupply)
      })

      it("should change when the balance multiplier changes", async function() {
        const { indexToken, reserveManager, nextReserveManager, minbalanceDivisorChangeDelay, maxbalanceDivisorChangePerSecondQ96, unprivileged0, startingTotalSupply } = await loadFixture(deployIndex)
        expect(await indexToken.totalSupply()).to.equal(startingTotalSupply)
        await indexToken.startMigration(
          nextReserveManager,
          minbalanceDivisorChangeDelay,
          maxbalanceDivisorChangePerSecondQ96
        )
        await increaseTime(Number(minbalanceDivisorChangeDelay) + 1)
        const totalSupplyEnd = await indexToken.totalSupply()
        expect(totalSupplyEnd).to.be.closeTo((startingTotalSupply << 96n) / maxbalanceDivisorChangePerSecondQ96, (totalSupplyEnd / 1_000_000_000_000n), "should be within 1 trillionth of the correct val")
      })

      it("should increase when minting", async function() {
        const { indexToken, reserveManager, nextReserveManager, minbalanceDivisorChangeDelay, maxbalanceDivisorChangePerSecondQ96, unprivileged0, startingTotalSupply } = await loadFixture(deployIndex)
        expect(await indexToken.totalSupply()).to.equal(startingTotalSupply)
        const mintAmount = 42069n
        await indexToken.mint(reserveManager, mintAmount)
        expect(await indexToken.totalSupply()).to.equal(startingTotalSupply + mintAmount)
      })

      it("should decrease when burning", async function() {
        const { indexToken, reserveManager, nextReserveManager, minbalanceDivisorChangeDelay, maxbalanceDivisorChangePerSecondQ96, unprivileged0, startingTotalSupply } = await loadFixture(deployIndex)
        expect(await indexToken.totalSupply()).to.equal(startingTotalSupply)
        const burnAmount = 42069n
        await indexToken.burnFrom(reserveManager, burnAmount)
        expect(await indexToken.totalSupply()).to.equal(startingTotalSupply - burnAmount)
      })
    })

    describe("balanceOf", function() {
      it("should return the correct value", async function() {
        const { indexToken, reserveManager, nextReserveManager, minbalanceDivisorChangeDelay, maxbalanceDivisorChangePerSecondQ96, unprivileged0, startingTotalSupply } = await loadFixture(deployIndex)
        expect(await indexToken.balanceOf(unprivileged0)).to.equal(0n)
        const mintAmount = 42069n
        await indexToken.mint(unprivileged0, mintAmount)
        expect(await indexToken.balanceOf(unprivileged0)).to.equal(mintAmount)
      })

      it("should change when the balance multiplier ticks down", async function() {
        const { indexToken, reserveManager, nextReserveManager, minbalanceDivisorChangeDelay, maxbalanceDivisorChangePerSecondQ96, unprivileged0, startingTotalSupply } = await loadFixture(deployIndex)
        expect(await indexToken.balanceOf(unprivileged0)).to.equal(0n)
        const mintAmount = 42069n
        await indexToken.mint(unprivileged0, mintAmount)
        expect(await indexToken.balanceOf(unprivileged0)).to.equal(mintAmount)
        await indexToken.startMigration(
          nextReserveManager,
          minbalanceDivisorChangeDelay,
          maxbalanceDivisorChangePerSecondQ96
        )
        await increaseTime(Number(minbalanceDivisorChangeDelay) + 1)
        expect(await indexToken.balanceOf(unprivileged0)).to.equal((mintAmount << 96n) / maxbalanceDivisorChangePerSecondQ96)

      })
    })

    describe("transfer", function() {
      it("should have no transfer inconsistencies due to rounding errors", async function() {
        const { indexToken, reserveManager, nextReserveManager, minbalanceDivisorChangeDelay, maxbalanceDivisorChangePerSecondQ96, unprivileged0, startingTotalSupply } = await loadFixture(deployIndex)
        await indexToken.mint(reserveManager, utils.scale10Pow18(1_000_000_000n))
        await indexToken.startMigration(
          nextReserveManager,
          minbalanceDivisorChangeDelay,
          maxbalanceDivisorChangePerSecondQ96
        )
        const totalSupply = await indexToken.totalSupply()
        await indexToken.finishMigration(totalSupply - BigInt(Math.floor(Math.random() * 1000)))
        const startingBalanceSender = await indexToken.balanceOf(reserveManager)
        const startingBalanceReceiver = await indexToken.balanceOf(unprivileged0)
        const transferAmount = BigInt(Math.floor(Math.random() * 1000))
        await indexToken.transfer(unprivileged0, transferAmount)
        const endingBalanceSender = await indexToken.balanceOf(reserveManager)
        const endingBalanceReceiver = await indexToken.balanceOf(unprivileged0)
        expect(endingBalanceSender).to.equal(startingBalanceSender - transferAmount)
        expect(endingBalanceReceiver).to.equal(startingBalanceReceiver + transferAmount)
      })

      it("should not affect total supply", async function() {
        const { indexToken, reserveManager, nextReserveManager, minbalanceDivisorChangeDelay, maxbalanceDivisorChangePerSecondQ96, unprivileged0, startingTotalSupply } = await loadFixture(deployIndex)
        const startTotalSupply = await indexToken.totalSupply()
        await indexToken.transfer(unprivileged0, 42069n)
        const endTotalSupply = await indexToken.totalSupply()
        expect(startTotalSupply).to.equal(endTotalSupply)
      })

      it("should not affect allowance", async function() {
        const { indexToken, reserveManager, nextReserveManager, minbalanceDivisorChangeDelay, maxbalanceDivisorChangePerSecondQ96, unprivileged0, startingTotalSupply } = await loadFixture(deployIndex)
        const startAllowance = await indexToken.allowance(reserveManager, reserveManager)
        await indexToken.transfer(unprivileged0, 42069n)
        const endAllowance = await indexToken.allowance(reserveManager, reserveManager)
        expect(startAllowance).to.equal(endAllowance)
      })
    })

    describe("allowance", function() {
      it("should return the allowance in visible units", async function() {
        const { indexToken, reserveManager, nextReserveManager, minbalanceDivisorChangeDelay, maxbalanceDivisorChangePerSecondQ96, unprivileged0, startingTotalSupply } = await loadFixture(deployIndex)
        const approveAmount = 1000n
        await indexToken.approve(unprivileged0, approveAmount)
        const allowancePreRebase = await indexToken.allowance(reserveManager, unprivileged0)
        expect(allowancePreRebase).to.equal(approveAmount)
        await indexToken.startMigration(
          nextReserveManager,
          minbalanceDivisorChangeDelay,
          maxbalanceDivisorChangePerSecondQ96
        )
        await indexToken.finishMigration(startingTotalSupply / 2n)
        const allowancePostRebase = await indexToken.allowance(reserveManager, unprivileged0)
        expect(allowancePostRebase).to.equal(allowancePreRebase)
        const transferAmount = 420n
        await indexToken.connect(unprivileged0).transferFrom(reserveManager, unprivileged0, transferAmount)
        const allowancePostTransfer = await indexToken.allowance(reserveManager, unprivileged0)
        expect(allowancePostTransfer).to.equal(allowancePostRebase - transferAmount)
      })

      it("allowance should not tick down with the balance multiplier", async function() {
        const { indexToken, reserveManager, nextReserveManager, minbalanceDivisorChangeDelay, maxbalanceDivisorChangePerSecondQ96, unprivileged0, startingTotalSupply } = await loadFixture(deployIndex)
        const approveAmount = 1000n
        await indexToken.approve(unprivileged0, approveAmount)
        const allowancePreRebase = await indexToken.allowance(reserveManager, unprivileged0)
        expect(allowancePreRebase).to.equal(approveAmount)
        await indexToken.startMigration(
          nextReserveManager,
          minbalanceDivisorChangeDelay,
          maxbalanceDivisorChangePerSecondQ96
        )
        await indexToken.finishMigration(startingTotalSupply / 2n)
        const allowancePostRebase = await indexToken.allowance(reserveManager, unprivileged0)
        expect(allowancePostRebase).to.equal(allowancePreRebase)
      })
    })

    describe("approve", function() {
      it("should set the allowance with the correct values", async function() {
        const { indexToken, reserveManager, nextReserveManager, minbalanceDivisorChangeDelay, maxbalanceDivisorChangePerSecondQ96, unprivileged0, startingTotalSupply } = await loadFixture(deployIndex)
        const approveAmount = 1000n
        await indexToken.approve(unprivileged0, approveAmount)
        expect(await indexToken.allowance(reserveManager, unprivileged0)).to.equal(approveAmount)
      })
    })

    describe("transferFrom", function() {
      it("should transfer the correct amount", async function() {
        const { indexToken, reserveManager, nextReserveManager, minbalanceDivisorChangeDelay, maxbalanceDivisorChangePerSecondQ96, unprivileged0, startingTotalSupply } = await loadFixture(deployIndex)
        const approveAmount = 1000n
        await indexToken.approve(unprivileged0, approveAmount)
        await indexToken.startMigration(
          nextReserveManager,
          minbalanceDivisorChangeDelay,
          maxbalanceDivisorChangePerSecondQ96
        )
        await indexToken.finishMigration(startingTotalSupply / 2n)
        const transferAmount = 420n
        const senderBalancePreTransfer = await indexToken.balanceOf(reserveManager)
        const receiverBalancePreTransfer = await indexToken.balanceOf(unprivileged0)
        await indexToken.connect(unprivileged0).transferFrom(reserveManager, unprivileged0, transferAmount)
        const senderBalancePostTransfer = await indexToken.balanceOf(reserveManager)
        const receiverBalancePostTransfer = await indexToken.balanceOf(unprivileged0)
        expect(senderBalancePostTransfer).to.equal(senderBalancePreTransfer - transferAmount)
        expect(receiverBalancePostTransfer).to.equal(receiverBalancePreTransfer + transferAmount)
      })

      it("should deduct the allowance by the correct amount", async function() {
        const { indexToken, reserveManager, nextReserveManager, minbalanceDivisorChangeDelay, maxbalanceDivisorChangePerSecondQ96, unprivileged0, startingTotalSupply } = await loadFixture(deployIndex)
        const approveAmount = 1000n
        await indexToken.approve(unprivileged0, approveAmount)
        await indexToken.startMigration(
          nextReserveManager,
          minbalanceDivisorChangeDelay,
          maxbalanceDivisorChangePerSecondQ96
        )
        await indexToken.finishMigration(startingTotalSupply / 2n)
        const transferAmount = 420n
        await indexToken.connect(unprivileged0).transferFrom(reserveManager, unprivileged0, transferAmount)
        const allowancePostTransfer = await indexToken.allowance(reserveManager, unprivileged0)
        expect(allowancePostTransfer).to.equal(approveAmount - transferAmount)
      })
    })

    describe("decimals", function() {
      it("should return the correct decimals", async function() {
        const { indexToken, reserveManager, nextReserveManager, minbalanceDivisorChangeDelay, maxbalanceDivisorChangePerSecondQ96, unprivileged0, startingTotalSupply } = await loadFixture(deployIndex)
        expect(await indexToken.decimals()).to.equal(18n)
      })
    })

    describe("mint", function() {
      it("should mint the correct amount and adjust total supply appropriately", async function() {
        const { indexToken, reserveManager, nextReserveManager, minbalanceDivisorChangeDelay, maxbalanceDivisorChangePerSecondQ96, unprivileged0, startingTotalSupply } = await loadFixture(deployIndex)
        const totalSupplyBefore = await indexToken.totalSupply()
        const mintAmount = 42069n
        const receiverBalanceBefore = await indexToken.balanceOf(unprivileged0)
        await indexToken.mint(unprivileged0, mintAmount)
        const totalSupplyAfter = await indexToken.totalSupply()
        const receiverBalanceAfter = await indexToken.balanceOf(unprivileged0)
        expect(totalSupplyAfter).to.equal(totalSupplyBefore + mintAmount)
        expect(receiverBalanceAfter).to.equal(receiverBalanceBefore + mintAmount)
      })

      it("should still work after a balance multiplier change", async function() {
        const { indexToken, reserveManager, nextReserveManager, minbalanceDivisorChangeDelay, maxbalanceDivisorChangePerSecondQ96, unprivileged0, startingTotalSupply } = await loadFixture(deployIndex)
        await indexToken.startMigration(
          nextReserveManager,
          minbalanceDivisorChangeDelay,
          maxbalanceDivisorChangePerSecondQ96
        )
        await indexToken.finishMigration(startingTotalSupply / 2n)
        const totalSupplyBefore = await indexToken.totalSupply()
        const mintAmount = 42069n
        const receiverBalanceBefore = await indexToken.balanceOf(unprivileged0)
        await indexToken.connect(nextReserveManager).mint(unprivileged0, mintAmount)
        const totalSupplyAfter = await indexToken.totalSupply()
        const receiverBalanceAfter = await indexToken.balanceOf(unprivileged0)
        expect(totalSupplyAfter).to.equal(totalSupplyBefore + mintAmount)
        expect(receiverBalanceAfter).to.equal(receiverBalanceBefore + mintAmount)
      })
    })

    describe("burnFrom", function() {
      it("should burn the correct amount", async function() {
        const { indexToken, reserveManager, nextReserveManager, minbalanceDivisorChangeDelay, maxbalanceDivisorChangePerSecondQ96, unprivileged0, startingTotalSupply } = await loadFixture(deployIndex)
        const totalSupplyBefore = await indexToken.totalSupply()
        const burnAmount = 42069n
        const receiverBalanceBefore = await indexToken.balanceOf(reserveManager)
        await indexToken.burnFrom(reserveManager, burnAmount)
        const totalSupplyAfter = await indexToken.totalSupply()
        const receiverBalanceAfter = await indexToken.balanceOf(reserveManager)
        expect(totalSupplyAfter).to.equal(totalSupplyBefore - burnAmount)
        expect(receiverBalanceAfter).to.equal(receiverBalanceBefore - burnAmount)
      })

      it("should still work after a balance multiplier change", async function() {
        const { indexToken, reserveManager, nextReserveManager, minbalanceDivisorChangeDelay, maxbalanceDivisorChangePerSecondQ96, unprivileged0, startingTotalSupply } = await loadFixture(deployIndex)
        await indexToken.startMigration(
          nextReserveManager,
          minbalanceDivisorChangeDelay,
          maxbalanceDivisorChangePerSecondQ96
        )
        await indexToken.finishMigration(startingTotalSupply / 2n)
        const totalSupplyBefore = await indexToken.totalSupply()
        const burnAmount = 42069n
        const receiverBalanceBefore = await indexToken.balanceOf(reserveManager)
        await indexToken.connect(nextReserveManager).burnFrom(reserveManager, burnAmount)
        const totalSupplyAfter = await indexToken.totalSupply()
        const receiverBalanceAfter = await indexToken.balanceOf(reserveManager)
        expect(totalSupplyAfter).to.equal(totalSupplyBefore - burnAmount)
        expect(receiverBalanceAfter).to.equal(receiverBalanceBefore - burnAmount)
      })
    })
  })
})