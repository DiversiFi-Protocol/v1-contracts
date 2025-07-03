const { ethers } = require("hardhat");
const { getCreateAddress, createPublicClient, http } = require("viem");
const { localhost } = require("viem/chains");
const chalk = require("chalk");
const utils = require("../test/testModules/utils.js");

async function main() {
	const [sender] = await ethers.getSigners();

	if (typeof process.env.TOKEN_AMOUNT != "undefined") {
		const MultiMinter = await ethers.getContractFactory("MultiMinter");
		const multiMinter = await MultiMinter.attach(
			"0x1D04C89BF5e1D292f5b931814426ae05665f29E2"
		);
		const tx = await multiMinter.mintAll(
			process.env.RECIPIENT,
			process.env.TOKEN_AMOUNT
		);
		const receipt = await tx.wait();
		console.log("token transfer tx:", receipt.hash);
	}
	

	if (typeof process.env.ETH_AMOUNT != "undefined") {
		const tx = await sender.sendTransaction({
			to: process.env.RECIPIENT,
			value: ethers.parseEther(process.env.ETH_AMOUNT),
		});
		const receipt = await tx.wait();
		console.log("eth transfer tx:", receipt.hash);
	}
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
