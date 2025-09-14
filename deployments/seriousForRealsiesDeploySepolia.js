const { ethers } = require("hardhat");
const { getCreateAddress } = require("viem");
const chalk = require("chalk");
const utils = require("../test/testModules/utils.js");
const initialAssetParams = require("./initialAssetParams.js")

const token0Decimals = 18n;
const token0Address = "0xa814D1722125151c1BcD363E79a60d59BFb8F53e"

const token1Decimals = 20n;
const token1Address = "0x1537e0CD1eAC6Dc732d0847139d9eACAEc323Db0"

const token2Decimals = 6n;
const token2Address = "0x8E9c43c72ab3a49Fdd242e5BB44B337e94979dd1"

const targetAllocation0 = utils.formatAllocationFromDecimal(0.4);
const targetAllocation1 = utils.formatAllocationFromDecimal(0.35);
const targetAllocation2 = utils.allocationRemainder([
  targetAllocation0,
  targetAllocation1,
]);
const testnetAssetParams = [
  {
    assetAddress: token0Address,
    targetAllocation: targetAllocation0,
    decimals: token0Decimals,
  },
  {
    assetAddress: token1Address,
    targetAllocation: targetAllocation1,
    decimals: token1Decimals,
  },
  {
    assetAddress: token2Address,
    targetAllocation: targetAllocation2,
    decimals: token2Decimals,
  },
];

//Bravo Labs DFI Admin Wallet
const MULTISIG_ADMIN = "0xD5ade97228C6d11B25aDc8A50AFc2d73fEEa2D8D"

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("deployer:", deployer.address)
  const ReserveManagerFactory = await ethers.getContractFactory("ReserveManagerV1");
  const TimelockControllerFactory = await ethers.getContractFactory("TimelockController")
  const IndexTokenFactory = await ethers.getContractFactory("IndexToken");

  let nonce = await hre.ethers.provider.getTransactionCount(deployer.address)

  const timelockControllerAddress = getCreateAddress({
    from: deployer.address,
    nonce: nonce + 1,
  });

  const reserveManagerAddress = getCreateAddress({
    from: deployer.address,
    nonce: nonce + 2,
  });

  // Deploy IndexToken Contract
  console.log(chalk.cyan("Deploying IndexToken contract..."));
  const indexToken = await IndexTokenFactory.deploy(
    "Diversified USD",
    "DFiUSD",
    timelockControllerAddress,
    reserveManagerAddress,
    [MULTISIG_ADMIN],
    60n * 60n * 12n, //12 hour minimum balance change delay
    utils.decimalToFixed(1.0000027639846123) //equivalent to 1.01 max change per hour
  );
  await indexToken.waitForDeployment();
  console.log(
    `IndexToken deployed to: ${await indexToken.getAddress()}`
  );

  console.log("\n----------------------------------\n");

  //Deploy TimelockController
  const timelockController = await TimelockControllerFactory.deploy(
    60n * 10n, //10 minutes
    [MULTISIG_ADMIN], //proposers
    [MULTISIG_ADMIN], //executors
    MULTISIG_ADMIN, //admin
  )
  console.log(
    `TimelockController deployed to: ${await timelockController.getAddress()}`
  );
  console.log(
    chalk.yellow("Predicted TimelockController address:"),
    timelockControllerAddress
  );

  console.log("\n----------------------------------\n");

  // Deploy reserveManager Contract
  console.log(chalk.cyan("Deploying ReserveManager contract..."));
  try {

  console.log(initialAssetParams)
  const reserveManager = await ReserveManagerFactory.deploy(
    timelockControllerAddress,
    MULTISIG_ADMIN,
    indexToken.getAddress(),
    utils.scaleToQ96(0n), //mintFeeQ96
    utils.scaleToQ96(0n), //burnFeeQ96
    utils.scale10Pow18(100_000_000n), //initial max reserves
    utils.decimalToFixed(0.0004), //0.04% per hour (~1% per day)
    testnetAssetParams
  );

  await reserveManager.waitForDeployment();
  console.log(`ReserveManager deployed to: ${await reserveManager.getAddress()}`);
  console.log(
    chalk.yellow("Predicted ReserveManager address:"),
    reserveManagerAddress
  );
} catch (err) {
  console.log(err)
}

  console.log(chalk.green("Done"));

  console.log("\n----------------------------------\n");

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
