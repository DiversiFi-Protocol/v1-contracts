const utils = require("./utils")

/*
  The definite integral of the price function with respect to specific reserves
  taken from the current specific reserves to r + x (x=input)
  returns the change in backed tokens given the change in specific reserves
*/
function priceIntegral(r, d, a, m, p, x) {
  const mSubAxMxX = (m - a * m) * x;
  const term = (d + r) / (d + r + x)
  const logTerm = Math.log(term)
  const dXMxLogTerm = d * m * logTerm
  const pxX = p * x
  return (m - a * m) * x + d * m * Math.log((d + r) / (d + r + x)) + p * x;
}

/*
  solves the price integral for x (input)
  returns the change in specific reserves given the change in backed tokens
*/
function solveForXNewton(I, r, d, a, m, p, tol = 0, maxIter = 20) {
  if(tol != 0) {
    tol = I * tol
  }
    let x = I / p;
    for (let i = 0; i < maxIter; i++) {
        let f_x = priceIntegral(r, d, a, m, p, x) - I;
        let df_x = (m - a * m) + p - (d * m) / (d + r + x);
        let x_new = x - f_x / df_x;
        if (Math.abs(x_new - x) < tol) break;
        x = x_new;
    }
  return x;
}

function outGivenInDeposit(_input, _specificReserves, _totalReserves, _currentTick) {
  const a = utils.fixedToDecimal(utils.scaleAllocation(_currentTick.allocation))
  const feeRate = utils.fixedToDecimal(utils.scaleFee(_currentTick.increaseFee))
  const r = Number(_specificReserves)
  const diff = Number(_totalReserves) - r
  const input = Number(_input)
  const m = utils.fixedToDecimal(utils.scalePriceSlope(_currentTick.priceSlope)) * -1
  const price = utils.fixedToDecimal(utils.scalePrice(_currentTick.price))
  const output = priceIntegral(
    r,
    diff,
    a,
    m,
    price, 
    input,
  )
  const fee = Math.floor(feeRate * output)
  return { output: output - fee, fee }
}

function inGivenOutDeposit(
  _output, 
  _specificReserves, 
  _totalReserves, 
  _currentTick
) {
  const a = utils.fixedToDecimal(utils.scaleAllocation(_currentTick.allocation))
  const feeRate = utils.fixedToDecimal(utils.scaleFee(_currentTick.increaseFee))
  const r = Number(_specificReserves)
  const diff = Number(_totalReserves) - r
  const fee = Math.floor(Number(_output) * (feeRate/(1-feeRate)))
  const output = Number(_output) + fee
  const m = utils.fixedToDecimal(utils.scalePriceSlope(_currentTick.priceSlope)) * -1
  const price = utils.fixedToDecimal(utils.scalePrice(_currentTick.price))
  const input = solveForXNewton(
    output,
    r,
    diff,
    a,
    m,
    price
  )
  return { input, fee }
}

function outGivenInWithdraw(_input, _specificReserves, _totalReserves, _currentTick) {
  const a = utils.fixedToDecimal(utils.scaleAllocation(_currentTick.allocation))
  const feeRate = utils.fixedToDecimal(utils.scaleFee(_currentTick.decreaseFee))
  const r = Number(_specificReserves)
  const diff = Number(_totalReserves) - r
  const fee = Number(_input) * feeRate
  const input = (Number(_input) - fee) * -1
  const m = utils.fixedToDecimal(utils.scalePriceSlope(_currentTick.priceSlope)) * -1
  const price = utils.fixedToDecimal(utils.scalePrice(_currentTick.price))
  const output = solveForXNewton(
    input,
    r,
    diff,
    a,
    m,
    price
  ) * -1
  return { output, fee: Math.floor(fee) }
}

function inGivenOutWithdraw(_output, _specificReserves, _totalReserves, _currentTick) {
  const a = utils.fixedToDecimal(utils.scaleAllocation(_currentTick.allocation))
  const feeRate = utils.fixedToDecimal(utils.scaleFee(_currentTick.decreaseFee))
  const r = Number(_specificReserves)
  const diff = Number(_totalReserves) - r
  const output = Number(_output) * -1
  const m = utils.fixedToDecimal(utils.scalePriceSlope(_currentTick.priceSlope)) * -1
  const price = utils.fixedToDecimal(utils.scalePrice(_currentTick.price))
  const input = priceIntegral(
    r,
    diff,
    a,
    m,
    price, 
    output,
  ) * -1
  const fee = Math.floor(input * feeRate / (1 - feeRate))
  return { input: input + fee, fee }
}

module.exports = {
  inGivenOutDeposit,
  outGivenInDeposit,
  inGivenOutWithdraw,
  outGivenInWithdraw,
  priceIntegral
}