const utils = require("../../test/testModules/utils")
const tokens = require("../../test/testModules/tokens")

const ALLOCATION_0 = Number(process.env.ALLOCATION_0)
//allocation1 is the remainder

const targetAllocation0 = utils.formatAllocationFromDecimal(ALLOCATION_0);
const targetAllocation1 = utils.allocationRemainder([
  targetAllocation0,
]);

const reserveManagerAddress = process.env.LIQUIDITY_POOL

async function main() {
  const ReserveManager = await ethers.getContractFactory("ReserveManager");
  const reserveManager = ReserveManager.attach(reserveManagerAddress)
  const receipt = await reserveManager.setTargetAssetParams(
    [
      {
        assetAddress: tokens.token0.address,
        targetAllocation: targetAllocation0,
        decimals: tokens.token0.decimals
      },
      {
        assetAddress: tokens.token1.address,
        targetAllocation: targetAllocation1,
        decimals: tokens.token1.decimals
      },
    ]
  );
  console.log("tx sent, hash:", receipt)
  await receipt.wait()
}




main()
.then(() => process.exit(0))
.catch((error) => {
  console.error(error);
  process.exit(1);
});
