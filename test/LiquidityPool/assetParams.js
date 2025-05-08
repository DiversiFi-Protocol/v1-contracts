const utils = require("../testModules/utils.js");

const decimals = 18;
const minAllocation =        0.11111111111111111111111111;
const lowerAllocation =      0.22222222222222222222222222;
const targetAllocation =     0.33333333333333333333333333;
const upperAllocation =      0.44444444444444444444444444;
const maxAllocation =        0.55555555555555555555555555;
const incompleteTicks = [
  {
    allocation: minAllocation,
    price: 1.01,
    increaseFee: 0,
    decreaseFee: 0.01,
  },
  {
    allocation: lowerAllocation,
    price: 1.001,
    increaseFee: 0.0001,
    decreaseFee: 0.0002,
  },
  {
    allocation: targetAllocation,
    price: 1,
    increaseFee: 0.0002,
    decreaseFee: 0.0001,
  },
  {
    allocation: upperAllocation,
    price: 0.999,
    increaseFee: 0.01,
    decreaseFee: 0,
  },
  {
    allocation: maxAllocation,
    price: 0.99,
    increaseFee: 0, // irrelevant in all situations
    decreaseFee: 0, // irrelevant in all situations
  },
];
const assetParams0 = utils.createAssetParams(
  decimals,
  targetAllocation,
  maxAllocation,
  incompleteTicks
);

assetParams0.decimals = 20n

const assetParams1 = utils.createAssetParams(
  decimals,
  targetAllocation,
  maxAllocation,
  incompleteTicks
);

assetParams1.decimals = 18n

const assetParams2 = utils.createAssetParams(
  decimals,
  targetAllocation,
  maxAllocation,
  incompleteTicks
);

assetParams2.decimals = 6n

const leftOverTargetAllocation =
  (2n ** 32n - 1n) - assetParams2.targetAllocation - assetParams1.targetAllocation;
assetParams2.targetAllocation = leftOverTargetAllocation
assetParams2.tickBoundaries[2] = leftOverTargetAllocation
assetParams2.tickData[2].allocation = leftOverTargetAllocation


module.exports = {
  assetParams0,
  assetParams1,
  assetParams2
}