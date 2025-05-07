

const SHIFT = 128n; //shift a normal integer to get 128.128 fixed point

const PRICE_SLOPE_SHIFT = SHIFT - 41n; //shift 7.41 fixed point to get 128.128 fixed point
const PRICE_SHIFT = SHIFT - 31n; //shift 1.31 fixed point to get 128.128 fixed point
const ALLOCATION_SHIFT = SHIFT - 32n; //shift 0.32 fixed point to get 128.128 fixed point
const FEE_SHIFT = SHIFT - 32n; //shift 0.32 fixed point to get 128.128 fixed point
const SCALE = 2n ** SHIFT; //1 shifted by shift
const MAX_UINT_16 = 65535n;
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

//converts a decimal into the fixed point scale for storing price slope in the contract
const formatPriceSlopeFromDecimal = num => {
  return decimalToFixed(num) >> PRICE_SLOPE_SHIFT
}

//converts a fixed point into the scale for storing price slope in the contract
const formatPriceSlopeFromFixed = num => {
  return num >> PRICE_SLOPE_SHIFT
}

const scalePriceSlope = num => {
  return num << PRICE_SLOPE_SHIFT
}

//converts a decimal into the fixed point scale for storing fee in the contract
const formatFeeFromDecimal = num => {
  return decimalToFixed(num) >> FEE_SHIFT
}

//converts a fixed point into the scale for storing fee in the contract
const formatFeeFromFixed = num => {
  return num >> FEE_SHIFT
}

const scaleFee = num => {
  return num << FEE_SHIFT
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

const createTickData = (upperBound, lowerBound) => {
  const x2 = decimalToFixed(upperBound.allocation);
  const x1 = decimalToFixed(lowerBound.allocation);
  const y2 = decimalToFixed(upperBound.price);
  const y1 = decimalToFixed(lowerBound.price);
  const m = (y2 - y1) * SCALE / (x2 - x1) * -1n;
  if (m < 0n) {
    throw new Error("price slope should always be negative")
  }
  const increaseFee = typeof lowerBound.increaseFee == 'undefined' ? 0 : lowerBound.increaseFee
  const decreaseFee = typeof lowerBound.decreaseFee == 'undefined' ? 0 : lowerBound.decreaseFee
  return {
      nextAllocation: formatAllocationFromDecimal(upperBound.allocation),
      allocation: formatAllocationFromDecimal(lowerBound.allocation),
      price: formatPriceFromDecimal(lowerBound.price),
      increaseFee: formatFeeFromDecimal(increaseFee),
      decreaseFee: formatFeeFromDecimal(decreaseFee),
      priceSlope: formatPriceSlopeFromFixed(m),
  };
}

const createTicks = (bounds) => {
  let previousBound = bounds[0]
  let ticks = []
  let tickBoundaries = []
  for(let i = 1; i < bounds.length; i++) {
    const completeTick = createTickData(bounds[i], previousBound)
    const boundary = formatAllocationFromDecimal(previousBound.allocation)
    previousBound = bounds[i]
    ticks.push(completeTick)
    tickBoundaries.push(boundary)
  }
  return { ticks, tickBoundaries }
}

const createAssetParams = (
  decimals,
  targetAllocation,
  maxAllocation,
  incompleteTicks
) => {
  const { ticks, tickBoundaries } = createTicks(incompleteTicks);
  const assetParams = {
    decimals: BigInt(decimals),
    targetAllocation: formatAllocationFromDecimal(targetAllocation),
    maxAllocation: formatAllocationFromDecimal(maxAllocation),
    minAllocation: formatAllocationFromDecimal(incompleteTicks[0].allocation),
    tickData: ticks,
    tickBoundaries
  };
  return assetParams;
}

function makeSlope(decimalStr, newfunc=false) {
  decimalStr = decimalStr.trim();
  const decimals = 18
  const [integerPart, decimalPart = ''] = decimalStr.split('.');
  const paddedDecimalPart = decimalPart.padEnd(decimals, '0').slice(0, decimals);
  const bigIntString = integerPart + paddedDecimalPart;
  return BigInt(bigIntString);
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
  formatPriceFromFixed,
  formatPriceSlopeFromFixed,
  formatFeeFromFixed,
  scalePrice,
  formatPriceFromDecimal,
  scalePriceSlope,
  formatPriceSlopeFromDecimal,
  scaleFee,
  formatFeeFromDecimal,
  decimalToFixed,
  fixedToDecimal,
  unscale10Pow18,
  createTicks,
  createTickData,
  createAssetParams,
  makeSlope,
  closeToBig,
  closeToBigPct,
  compareFunctions,
  SCALE,
  MAX_UINT_16,
  MAX_UINT_256,
  ALLOCATION_SHIFT,
  SHIFT,
  FEE_SHIFT,
  PRICE_SHIFT,
  PRICE_SLOPE_SHIFT,
}