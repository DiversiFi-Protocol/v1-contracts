const { ethers } = require("hardhat");

async function main() {
  const tokenAddresses = process.env.TOKEN_ADDRESSES;
  const addressList = tokenAddresses.split(',');
  const multiMinterFactory = await ethers.getContractFactory("MultiMinter");
  const multiMinter = await multiMinterFactory.deploy(addressList);
  await multiMinter.waitForDeployment()
  console.log(`multiMinter deployed to: ${await multiMinter.getAddress()}`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

//~~~~~~~~~Sepolia Tokens~~~~~~~~~
//0xa814D1722125151c1BcD363E79a60d59BFb8F53e
//0x1537e0CD1eAC6Dc732d0847139d9eACAEc323Db0
//0x8E9c43c72ab3a49Fdd242e5BB44B337e94979dd1
//0xbe2Ad83eAa604721AC467390dd86bEB86E1DF3Bd
//0x3fa8C580BE8fd0e620A8d2D43Cbcf0c8a5470cC3
//0xa814D1722125151c1BcD363E79a60d59BFb8F53e,0x1537e0CD1eAC6Dc732d0847139d9eACAEc323Db0,0x8E9c43c72ab3a49Fdd242e5BB44B337e94979dd1,0xbe2Ad83eAa604721AC467390dd86bEB86E1DF3Bd,0x3fa8C580BE8fd0e620A8d2D43Cbcf0c8a5470cC3
