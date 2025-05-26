const utils = require("../test/testModules/utils.js");

const decimals = 18;
const targetAllocation =     0.33333333333333333333333333;

const assetParams0 = utils.createAssetParams(
  decimals,
  targetAllocation,
  maxAllocation,
);

assetParams0.decimals = 20n

const assetParams1 = utils.createAssetParams(
  decimals,
  targetAllocation,
  maxAllocation,
);

assetParams1.decimals = 18n

const assetParams2 = utils.createAssetParams(
  decimals,
  targetAllocation,
  maxAllocation,
);

assetParams2.decimals = 6n

const leftOverTargetAllocation =
  (2n ** 88n - 1n) - assetParams2.targetAllocation - assetParams1.targetAllocation;
assetParams2.targetAllocation = leftOverTargetAllocation
assetParams2.tickBoundaries[2] = leftOverTargetAllocation
assetParams2.tickData[2].allocation = leftOverTargetAllocation


module.exports = {
  assetParams0,
  assetParams1,
  assetParams2
}