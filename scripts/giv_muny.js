const { ethers } = require("hardhat");
const { getCreateAddress, createPublicClient, http } = require("viem");
const { localhost } = require("viem/chains");
const chalk = require("chalk");
const utils = require("../test/testModules/utils.js");

async function main() {
	const [sender] = await ethers.getSigners();

	const MultiMinter = await ethers.getContractFactory("MultiMinter");
	const multiMinter = await MultiMinter.deploy([
		"0xa814D1722125151c1BcD363E79a60d59BFb8F53e",
		"0x1537e0CD1eAC6Dc732d0847139d9eACAEc323Db0",
		"0x8E9c43c72ab3a49Fdd242e5BB44B337e94979dd1",
	]);
	await multiMinter.waitForDeployment();
	console.log("multiminter deployment address:", multiMinter.target);
	// const multiMinter = MultiMinter.attach(
	// "0x4337f8997DD393B51E842402eCd8d0c9955b7723"
	// );
	const tx = await multiMinter.mintAll(
		process.env.RECIPIENT,
		process.env.TOKEN_AMOUNT
	);
	const receipt = await tx.wait();
	console.log("token transfer tx:", receipt.hash);

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
