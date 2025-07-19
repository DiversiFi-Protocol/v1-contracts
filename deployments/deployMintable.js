const { ethers } = require("hardhat");

async function main() {
  const MintableStableCoin = await ethers.getContractFactory("MintableERC20");
  const tokenName = process.env.TOKEN_NAME
  const tokenSymbol = process.env.TOKEN_SYMBOL
  const tokenDecimals = BigInt(process.env.TOKEN_DECIMALS)
  const token = await MintableStableCoin.deploy(
    tokenName,
    tokenSymbol,
    tokenDecimals
  )
  await token.waitForDeployment();
  console.log(`token deployed to: ${await token.getAddress()}`)
  console.log(`name: ${await token.name()}`)
  console.log(`symbol: ${await token.symbol()}`)
  console.log(`decimals: ${await token.decimals()}`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
