

const min = 10n ** 18n;
const max = 10n ** 30n;

const main = async () => {
  for (let i = 0; i < 1_000_000_000; i++) {
    const randAllocationDecimal = Math.random()
    const randAllocationFormatted = utils.formatAllocationFromDecimal(randAllocationDecimal)
    const randAllocationFixed = utils.scaleAllocation(randAllocationFormatted)
    const randTotalReserves = utils.randomBigInt(min, max)
    const specificReservesAllocationDecimal = utils.randomBetween(randAllocationDecimal, 1)
    const specificReservesAllocationFormatted = utils.formatAllocationFromDecimal(specificReservesAllocationDecimal)
    const specificReservesAllocationFixed = utils.scaleAllocation(specificReservesAllocationFormatted)
    const startingReserves = (specificReservesAllocationFixed * randTotalReserves) >> SHIFT
    // console.log("randAllocationDecimal:", randAllocationDecimal, "specificReserves:", startingReserves, "totalReserves:", randTotalReserves)
    const maxWithdrawal = await poolMathWrapper.calcStepMaxWithdrawal(randAllocationFormatted, startingReserves, randTotalReserves)
    const endingSpecificReserves = startingReserves - maxWithdrawal
    const endingTotalReserves = randTotalReserves - maxWithdrawal
    const allocationMinReserves = (randAllocationFixed * endingTotalReserves) >> SHIFT
    if (endingSpecificReserves - allocationMinReserves != 1) {
      console.log("BIGG OOPSIE!!!")
    }
    if(i % 1_000 == 0) {
      console.log("i:", i)
    }
    // console.log(endingSpecificReserves - allocationMinReserves)
  }
}