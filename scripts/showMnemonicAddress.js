require("dotenv").config();

const { Wallet } = require("ethers");

function main() {
	const mnemonic = process.env.MNEMONIC;

	if (!mnemonic) {
		throw new Error("MNEMONIC is not set");
	}

	const wallet = Wallet.fromPhrase(mnemonic);
	console.log(wallet.address);
}

main();
