const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const utils = require("../../test/testModules/utils");

async function deployIndex() {
  const [liquidityPool, nextLiquidityPool, unprivileged0] = await hre.ethers.getSigners()
  const tokenName = "Diversified USD";
  const tokenSymbol = "USD1";
  const minBalanceMultiplierChangeDelay = 100n
  const maxBalanceMultiplierChangePerSecondQ96 = utils.decimalToFixed(1.001)
  const indexToken = await hre.ethers.deployContract("IndexToken", [
    tokenName,
    tokenSymbol,
    liquidityPool.address,
    minBalanceMultiplierChangeDelay,
    maxBalanceMultiplierChangePerSecondQ96
  ]);
  const startingTotalSupply = utils.scale10Pow18(1_000_000n)
  await indexToken.mint(liquidityPool.address, startingTotalSupply)
  return { indexToken, liquidityPool, nextLiquidityPool, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96, unprivileged0, startingTotalSupply }
}

async function main() {
  for (let i = 0; i < 100_000_000_000; i++) {
    const { indexToken, liquidityPool, nextLiquidityPool, minBalanceMultiplierChangeDelay, maxBalanceMultiplierChangePerSecondQ96, unprivileged0, startingTotalSupply } = await loadFixture(deployIndex)
    await indexToken.mint(liquidityPool, utils.scale10Pow18(1_000_000_000n))
    await indexToken.startMigration(
      nextLiquidityPool,
      minBalanceMultiplierChangeDelay,
      maxBalanceMultiplierChangePerSecondQ96
    )
    const totalSupply = await indexToken.totalSupply()
    await indexToken.finishMigration(totalSupply - (BigInt(i) * BigInt(Math.floor(Math.random() * 1000))))
    const startingBalanceSender = await indexToken.balanceOf(liquidityPool)
    const startingBalanceReceiver = await indexToken.balanceOf(unprivileged0)
    const transferAmount = BigInt(Math.floor(Math.random() * 1000))
    await indexToken.transfer(unprivileged0, transferAmount)
    const endingBalanceSender = await indexToken.balanceOf(liquidityPool)
    const endingBalanceReceiver = await indexToken.balanceOf(unprivileged0)
    if (endingBalanceSender != startingBalanceSender - transferAmount) {
      console.log("BIG OOPSIE")
      process.exit()
    }
    if (endingBalanceReceiver != startingBalanceReceiver + transferAmount) {
      console.log("BIG OOPSIE")
      process.exit()
    }
    if (i % 1000 == 0) {
      console.log("inputs checked: ",)
    }
  }
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
