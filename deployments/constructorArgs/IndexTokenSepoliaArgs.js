const utils = require("../../test/testModules/utils.js")

module.exports = [
  "Diversified USD",
  "DFiUSD",
  "",//timelock controller
  "",//reserve manager
  43200,//12 hour minimum balance change delay
  utils.decimalToFixed(1.0000027639846123)//equivalent to 1.01 max change per hour
]