const { ethers } = require("hardhat");
const { getCreateAddress, createPublicClient, http } = require("viem");
const { localhost } = require("viem/chains");
const chalk = require("chalk");
const utils = require("../test/testModules/utils.js");

async function main() {
  const [deployer] = await ethers.getSigners();

  const ReserveManagerHelpersFactory = await ethers.getContractFactory("ReserveManagerHelpers")

  const reserveManagerHelpers = await ReserveManagerHelpersFactory.deploy("0x8978F3A0227453Dd0821bC8A85e4bEF96DAF8327")
  console.log("reserveManagerHelpers deployed to:", await reserveManagerHelpers.getAddress())

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
