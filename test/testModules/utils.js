const SHIFT = 128n; //shift a normal integer to get 128.128 fixed point

const ALLOCATION_SHIFT = SHIFT - 88n; //shift 0.88 fixed point to get 128.128 fixed point
const SCALE = 2n ** SHIFT; //1 shifted by shift
const MAX_UINT_256 = (2n ** 256n) - 1n;

//returns the proportion difference between the output of two functions
const compareFunctions = (func0, func1, args, args1=[]) => {
  const result0 = func0(...args)
  const result1 = args1.length == 0 ? func1(...args) : func1(...args1)

  const diff = (result1 - result0) / result0
  return diff
}

const decimalToFixed = (num) => {
  return BigInt(Math.floor(num * Number(SCALE)))
}

const fixedToDecimal = num => {
  return Number(num) / Number(SCALE)
}

//converts a decimal into the fixed point scale for storing price in the contract
const formatPriceFromDecimal = num => {
  return decimalToFixed(num) >> PRICE_SHIFT
}

//converts a fixed point into the scale for storing price in the contract
const formatPriceFromFixed = num => {
  return num >> PRICE_SHIFT
}

const scalePrice = num => {
  return num << PRICE_SHIFT
}

//converts a decimal into the fixed point scale for storing allocation in the contract
const formatAllocationFromDecimal = num => {
  return decimalToFixed(num) >> ALLOCATION_SHIFT
}

//converts a fixed point into the scale for storing allocation in the contract
const formatAllocationFromFixed = num => {
  return num >> ALLOCATION_SHIFT
}

const scaleAllocation = num => {
  return num << ALLOCATION_SHIFT
}

const scale10Pow18 = (num) => {
  return num * 10n ** 18n;
}

const unscale10Pow18 = (num) => {
  return num / 10n ** 18n;
}

const scaleDecimals = (num, fromDecimals, toDecimals) => {
  if (fromDecimals > toDecimals) {
    return num / (10n ** BigInt(fromDecimals - toDecimals));
  } else if (fromDecimals < toDecimals) {
    return num * (10n ** BigInt(toDecimals - fromDecimals));
  }
  return num;
}

const createAssetParams = (
  decimals,
  targetAllocation,
  assetAddress
) => {
  const assetParams = {
    decimals: BigInt(decimals),
    targetAllocation: formatAllocationFromDecimal(targetAllocation),
    assetAddress,
  };
  return assetParams;
}

const closeToBig = (actual, expected, tolerance) => {
  if (expected > actual) {
    if (expected - actual < tolerance) {
      return true;
    } else {
      console.log("expected:", expected, "actual:", actual, "tolerance:", tolerance);
      return false;
    }
  } else {
    if (actual - expected < tolerance) {
      return true;
    } else {
      console.log("expected:", expected, "actual:", actual, "tolerance:", tolerance);
      return false;
    }
  }
}

const closeToBigPct = (actual, expected, pctTolerance) => {
  const scaledPct = decimalToBigInt(pctTolerance);
  const tolerance = scaledPct * expected / SCALE;
  return closeToBig(actual, expected, tolerance);
}

function randomBigInt(min, max) {
  const range = max - min;
  const rangeStrLength = range.toString().length;

  let rand;
  do {
    // Generate a string of random digits
    let randStr = '';
    for (let i = 0; i < rangeStrLength; i++) {
      randStr += Math.floor(Math.random() * 10); // Random digit 0–9
    }
    rand = BigInt(randStr);
  } while (rand > range);

  return min + rand;
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}


module.exports = {
  scaleDecimals,
  randomBetween,
  randomBigInt,
  scale10Pow18,
  scaleAllocation,
  formatAllocationFromDecimal,
  formatAllocationFromFixed,
  scalePrice,
  formatPriceFromDecimal,
  decimalToFixed,
  fixedToDecimal,
  unscale10Pow18,
  createAssetParams,
  closeToBig,
  closeToBigPct,
  compareFunctions,
  SCALE,
  MAX_UINT_256,
  ALLOCATION_SHIFT,
  SHIFT,
}