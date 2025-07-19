const { ethers } = require("hardhat");
const tokens = require("../../test/testModules/tokens")

const liquidityPoolAddress = process.env.LIQUIDITY_POOL

async function main() {
  const MintableStableCoin = await ethers.getContractFactory("MintableERC20");
  const LiquidityPool = await ethers.getContractFactory("LiquidityPool");
  const liquidityPool = LiquidityPool.attach(liquidityPoolAddress)
  const allTokens = [ tokens.token0, tokens.token1, tokens.token2, tokens.token3, tokens.token4 ]
  console.log("checking token allowances...")
  const promises = allTokens.map(async token => {
    tokenContract = await MintableStableCoin.attach(token.address);
    tokenAllowance = tokenContract.allowance()
    if (tokenAllowance != ethers.MaxUint256) {
      receipt = await tokenContract.approve(liquidityPoolAddress, ethers.MaxUint256)
      await receipt.wait();
      console.log("confirmed approval tx for token: ", token.address, "txHash:", receipt.hash)
    }
  })
  await Promise.all(promises)
  const receipt = await liquidityPool.equalize()
  await receipt.wait()
  console.log("equalize tx confirmed: ", receipt.hash)
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
