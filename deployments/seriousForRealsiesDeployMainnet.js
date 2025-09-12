const { ethers } = require("hardhat");
const { getCreateAddress } = require("viem");
const chalk = require("chalk");
const utils = require("../test/testModules/utils.js");
const initialAssetParams = require("./initialAssetParams.js")

//Bravo Labs DFI Admin Wallet
const MULTISIG_ADMIN = "0xD5ade97228C6d11B25aDc8A50AFc2d73fEEa2D8D"

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("deployer:", deployer.address)
  const ReserveManagerFactory = await ethers.getContractFactory("ReserveManagerV1");
  const TimelockControllerFactory = await ethers.getContractFactory("TimelockController")
  const IndexTokenFactory = await ethers.getContractFactory("IndexToken");

  const indexTokenAddress = getCreateAddress({
    from: deployer.address,
    nonce: 0
  })

  if (indexTokenAddress != "0xDF100b8ABd3cd41fC5cC1236AD7c6629A901AfBf") {
    console.log("incorrect deployer account")
    return
  }

  const timelockControllerAddress = getCreateAddress({
    from: deployer.address,
    nonce: 1,
  });

  const reserveManagerAddress = getCreateAddress({
    from: deployer.address,
    nonce: 2,
  });

  // Deploy IndexToken Contract
  let nonce = await hre.ethers.provider.getTransactionCount(deployer.address)
  console.log("nonce:", nonce)
  if (nonce == 0) {
    console.log(chalk.cyan("Deploying IndexToken contract..."));
    await sleep(5000)
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
    return
  }


  //Deploy TimelockController
  nonce = await hre.ethers.provider.getTransactionCount(deployer.address)
  console.log("nonce:", nonce)
  if (nonce == 1) {
    console.log("deploying timlockController...")
    await sleep(5000)
    const timelockController = await TimelockControllerFactory.deploy(
      60n * 60n * 24n * 7n, //7 days
      [MULTISIG_ADMIN], //proposers
      [MULTISIG_ADMIN], //executors
      ethers.ZeroAddress, //default admin
    )
    console.log(
      `TimelockController deployed to: ${await timelockController.getAddress()}`
    );
    console.log(
      chalk.yellow("Predicted TimelockController address:"),
      timelockControllerAddress
    );

    console.log("\n----------------------------------\n");
    return
  }


  // Deploy reserveManager Contract
  nonce = await hre.ethers.provider.getTransactionCount(deployer.address)
  console.log("nonce:", nonce)
  if (nonce == 2) {
    console.log(chalk.cyan("Deploying ReserveManager contract..."));
    await sleep(5000)
    console.log(initialAssetParams)
    const reserveManager = await ReserveManagerFactory.deploy(
      timelockControllerAddress,
      MULTISIG_ADMIN,
      indexTokenAddress,
      utils.scaleToQ96(0n), //mintFeeQ96
      utils.scaleToQ96(0n), //burnFeeQ96
      utils.scale10Pow18(100_000_000n), //initial max reserves
      utils.decimalToFixed(0.0004), //0.04% per hour (~1% per day)
      initialAssetParams
    );

    await reserveManager.waitForDeployment();
    console.log(`ReserveManager deployed to: ${await reserveManager.getAddress()}`);
    console.log(
      chalk.yellow("Predicted ReserveManager address:"),
      reserveManagerAddress
    );

    console.log("\n----------------------------------\n");
    return
  }

  nonce = await hre.ethers.provider.getTransactionCount(deployer.address)
  console.log("nonce:", nonce)
  if (nonce == 3) {
    console.log("deploying ReserveManagerHelpers contract...")
    await sleep(5000)
    const ReserveManagerHelpersFactory = await ethers.getContractFactory("ReserveManagerHelpers")
    
    const reserveManagerHelpers = await ReserveManagerHelpersFactory.deploy(await reserveManagerAddress)
    console.log("reserveManagerHelpers deployed to:", await reserveManagerHelpers.getAddress())

    console.log("\n----------------------------------\n");
    return
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}