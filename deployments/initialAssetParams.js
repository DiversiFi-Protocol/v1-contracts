const utils = require("../test/testModules/utils.js");
const addressBook = require("./addressBook.js");

const USDC_ALLOC = utils.formatAllocationFromDecimal(0.3)
const USDS_ALLOC = utils.formatAllocationFromDecimal(0.15)
const DAI_ALLOC = utils.formatAllocationFromDecimal(0.15)
const USDT_ALLOC = utils.formatAllocationFromDecimal(0.1)
const FRXUSD_ALLOC = utils.formatAllocationFromDecimal(0.1)
const FDUSD_ALLOC = utils.formatAllocationFromDecimal(0.1)
const GHO_ALLOC = utils.allocationRemainder([ //0.1
  USDC_ALLOC, USDS_ALLOC, DAI_ALLOC, USDT_ALLOC, FRXUSD_ALLOC, FDUSD_ALLOC
])

module.exports = [
  {
    assetAddress: addressBook.USDC.address,
    targetAllocation: USDC_ALLOC,
    decimals: addressBook.USDC.decimals
  },
  {
    assetAddress: addressBook.USDS.address,
    targetAllocation: USDS_ALLOC,
    decimals: addressBook.USDS.decimals
  },
  {
    assetAddress: addressBook.DAI.address,
    targetAllocation: DAI_ALLOC,
    decimals: addressBook.DAI.decimals
  },
  {
    assetAddress: addressBook.USDT.address,
    targetAllocation: USDT_ALLOC,
    decimals: addressBook.USDT.decimals
  },
  {
    assetAddress: addressBook.FRXUSD.address,
    targetAllocation: FRXUSD_ALLOC,
    decimals: addressBook.FRXUSD.decimals
  },
  {
    assetAddress: addressBook.FDUSD.address,
    targetAllocation: FDUSD_ALLOC,
    decimals: addressBook.FDUSD.decimals
  },
  {
    assetAddress: addressBook.GHO.address,
    targetAllocation: GHO_ALLOC,
    decimals: addressBook.GHO.decimals
  }
]
