const utils = require("../test/testModules/utils")

const token0Address = "0xa814D1722125151c1BcD363E79a60d59BFb8F53e"
const token0Decimals = 18n
const token1Address = "0x1537e0CD1eAC6Dc732d0847139d9eACAEc323Db0"
const token1Decimals = 20n
const token2Address = "0x8E9c43c72ab3a49Fdd242e5BB44B337e94979dd1"
const token2Decimals = 6n
const targetAllocation0 = utils.formatAllocationFromDecimal(0.69);
const targetAllocation1 = utils.formatAllocationFromDecimal(0.042);
const targetAllocation2 = utils.allocationRemainder([
  targetAllocation0,
  targetAllocation1,
]);

const liquidityPoolAddress = process.env.LIQUIDITY_POOL

async function main() {
  const LiquidityPool = await ethers.getContractFactory("LiquidityPool");
  const liquidityPool = LiquidityPool.attach(liquidityPoolAddress)
  const receipt = await liquidityPool.setTargetAssetParams(
    [
      {
        assetAddress: token0Address,
        targetAllocation: targetAllocation0,
        decimals: token0Decimals
      },
      {
        assetAddress: token1Address,
        targetAllocation: targetAllocation1,
        decimals: token1Decimals
      },
      {
        assetAddress: token2Address,
        targetAllocation: targetAllocation2,
        decimals: token2Decimals
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
