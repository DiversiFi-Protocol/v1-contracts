const { ethers } = require("hardhat");
const { getCreateAddress } = require("viem");
const chalk = require("chalk");
const utils = require("../test/testModules/utils.js");
const initialAssetParams = require("./initialAssetParams.js")

const MULTISIG_ADMIN = ""

async function main() {
  const [deployer] = await ethers.getSigners();
  const ReserveManagerFactory = await ethers.getContractFactory("ReserveManagerV1");
  const TimelockControllerFactory = await ethers.getContractFactory("TimelockController")
  const IndexTokenFactory = await ethers.getContractFactory("IndexToken");

  // Deploy TimelockController
  const timelockController = await TimelockControllerFactory.deploy(
    60n * 60n, //1 hour
    MULTISIG_ADMIN, //proposer
    MULTISIG_ADMIN, //executor
    MULTISIG_ADMIN, //admin
  )

  let nonce = await hre.ethers.provider.getTransactionCount(deployer.address)

  const reserveManagerAddress = getCreateAddress({
    from: deployer.address,
    nonce: nonce + 1,
  });

  // Deploy IndexToken Contract
  console.log(chalk.cyan("Deploying IndexToken contract..."));
  const indexToken = await IndexTokenFactory.deploy(
    "Diversified USD",
    "DFiUSD",
    reserveManagerAddress,
    timelockController.getAddress()
  );
  await indexToken.waitForDeployment();
  console.log(
    `IndexToken deployed to: ${await indexToken.getAddress()}`
  );

  console.log("\n----------------------------------\n");

  // Deploy reserveManager Contract
  console.log(chalk.cyan("Deploying ReserveManager contract..."));
  const reserveManager = await ReserveManagerFactory.deploy(
    timelockController.getAddress(),
    MULTISIG_ADMIN,
    indexToken.getAddress(),
    utils.scaleToQ96(0n), //mintFeeQ96
    utils.scaleToQ96(0n), //burnFeeQ96
    utils.scale10Pow18(100_000_000n), //initial max reserves
    utils.decimalToFixed(0.0001), //0.01% per hour
    initialAssetParams
  );

  await reserveManager.waitForDeployment();
  console.log(`ReserveManager deployed to: ${await reserveManager.getAddress()}`);
  console.log(
    chalk.yellow("Predicted ReserveManager address:"),
    reserveManagerAddress
  );

  console.log(chalk.green("Done"));

  console.log("\n----------------------------------\n");

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
