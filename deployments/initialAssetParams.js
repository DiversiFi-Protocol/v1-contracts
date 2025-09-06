const utils = require("../test/testModules/utils.js");
const addressBook = require("./addressBook.js");

module.exports = [
  {
    assetAddress: addressBook.USDC.address,
    targetAllocation: utils.formatAllocationFromDecimal(0.3),
    decimals: addressBook.USDC.decimals
  },
  {
    assetAddress: addressBook.USDS.address,
    targetAllocation: utils.formatAllocationFromDecimal(0.15),
    decimals: addressBook.USDS.decimals
  },
  {
    assetAddress: addressBook.DAI.address,
    targetAllocation: utils.formatAllocationFromDecimal(0.15),
    decimals: addressBook.DAI.decimals
  },
  {
    assetAddress: addressBook.USDT.address,
    targetAllocation: utils.formatAllocationFromDecimal(0.10),
    decimals: addressBook.USDT.decimals
  },
  {
    assetAddress: addressBook.FrxUSD.address,
    targetAllocation: utils.formatAllocationFromDecimal(0.10),
    decimals: addressBook.FrxUSD.decimals
  },
  {
    assetAddress: addressBook.FDUSD.address,
    targetAllocation: utils.formatAllocationFromDecimal(0.10),
    decimals: addressBook.FDUSD.decimals
  },
  {
    assetAddress: addressBook.GHO.address,
    targetAllocation: utils.formatAllocationFromDecimal(0.10),
    decimals: addressBook.GHO.decimals
  }
]
