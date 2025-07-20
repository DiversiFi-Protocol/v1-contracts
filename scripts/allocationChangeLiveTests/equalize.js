const { ethers } = require("hardhat");
const tokens = require("../../test/testModules/tokens")

const liquidityPoolAddress = process.env.LIQUIDITY_POOL

async function main() {
  const [signer] = await ethers.getSigners()
  const MintableStableCoin = await ethers.getContractFactory("MintableERC20");
  const LiquidityPool = await ethers.getContractFactory("LiquidityPool");
  const liquidityPool = LiquidityPool.attach(liquidityPoolAddress)
  const allTokens = [ tokens.token0, tokens.token1, tokens.token2, tokens.token3, tokens.token4 ]
  console.log("checking token allowances...")
  for(let i = 0; i < allTokens.length; i++) {
    token = allTokens[i]
    tokenContract = await MintableStableCoin.attach(token.address);
    tokenAllowance = await tokenContract.allowance(signer, liquidityPoolAddress)
    console.log("allowance:", tokenAllowance, "(want)", ethers.MaxUint256)
    if (tokenAllowance != ethers.MaxUint256) {
      const receipt = await tokenContract.approve(liquidityPoolAddress, ethers.MaxUint256)
      await receipt.wait();
      console.log("confirmed approval tx for token: ", token.address, "txHash:", receipt.hash)
    }
  }
  const receipt = await liquidityPool.equalizeToTarget()
  await receipt.wait()
  console.log("equalize tx confirmed: ", receipt.hash)
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
