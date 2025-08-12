const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const utils = require("../../test/testModules/utils");

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

async function main() {
  for (let i = 0; i < 100_000_000_000; i++) {
    const { indexToken, reserveManager, nextReserveManager, minbalanceDivisorChangeDelay, maxbalanceDivisorChangePerSecondQ96, unprivileged0, startingTotalSupply } = await loadFixture(deployIndex)
    await indexToken.mint(reserveManager, utils.scale10Pow18(1_000_000_000n))
    await indexToken.startMigration(
      nextReserveManager,
      minbalanceDivisorChangeDelay,
      maxbalanceDivisorChangePerSecondQ96
    )
    const totalSupply = await indexToken.totalSupply()
    await indexToken.finishMigration(totalSupply - (BigInt(i) * BigInt(Math.floor(Math.random() * 1000))))
    const startingBalanceSender = await indexToken.balanceOf(reserveManager)
    const startingBalanceReceiver = await indexToken.balanceOf(unprivileged0)
    const transferAmount = BigInt(Math.floor(Math.random() * 1000))
    await indexToken.transfer(unprivileged0, transferAmount)
    const endingBalanceSender = await indexToken.balanceOf(reserveManager)
    const endingBalanceReceiver = await indexToken.balanceOf(unprivileged0)
    if (endingBalanceSender != startingBalanceSender - transferAmount) {
      console.log("BIG OOPSIE")
      console.log(totalSupply, startingBalanceSender, startingBalanceReceiver, transferAmount, endingBalanceSender, endingBalanceReceiver)
      process.exit()
    }
    if (endingBalanceReceiver != startingBalanceReceiver + transferAmount) {
      console.log("BIG OOPSIE")
      console.log(totalSupply, startingBalanceSender, startingBalanceReceiver, transferAmount, endingBalanceSender, endingBalanceReceiver)
      process.exit()
    }
    if (i % 1000 == 0) {
      console.log("inputs checked: ", i)
    }
  }
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
