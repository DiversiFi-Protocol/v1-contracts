const utils = require("../../test/testModules/utils")
const tokens = require("../../test/testModules/tokens")

const ALLOCATION_0 = Number(process.env.ALLOCATION_0)
const ALLOCATION_1 = Number(process.env.ALLOCATION_1)
const ALLOCATION_2 = Number(process.env.ALLOCATION_2)
//allocation3 is the remainder

const targetAllocation0 = utils.formatAllocationFromDecimal(ALLOCATION_0);
const targetAllocation1 = utils.formatAllocationFromDecimal(ALLOCATION_1);
const targetAllocation2 = utils.formatAllocationFromDecimal(ALLOCATION_2);
const targetAllocation3 = utils.allocationRemainder([
  targetAllocation0,
  targetAllocation1,
  targetAllocation2,
]);

const liquidityPoolAddress = process.env.LIQUIDITY_POOL

async function main() {
  const LiquidityPool = await ethers.getContractFactory("LiquidityPool");
  const liquidityPool = LiquidityPool.attach(liquidityPoolAddress)
  const receipt = await liquidityPool.setTargetAssetParams(
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
      {
        assetAddress: tokens.token2.address,
        targetAllocation: targetAllocation2,
        decimals: tokens.token2.decimals
      },
      {
        assetAddress: tokens.token3.address,
        targetAllocation: targetAllocation3,
        decimals: tokens.token3.decimals
      }
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
