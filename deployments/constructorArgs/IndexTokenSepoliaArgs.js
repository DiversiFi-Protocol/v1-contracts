const utils = require("../../test/testModules/utils.js")

module.exports = [
  "Diversified USD",
  "DFiUSD",
  "0x0F688325E86eDf0d0Da187f436a46C47C8F6CDC3",//timelock controller
  "0x99a9A2a0E1A6F9ce6AAEf1c38e7Aad70fB2a5fe9",//reserve manager
  43200,//12 hour minimum balance change delay
  utils.decimalToFixed(1.0000027639846123)//equivalent to 1.01 max change per hour
]