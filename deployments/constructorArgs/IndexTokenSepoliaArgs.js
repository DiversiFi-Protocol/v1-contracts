const utils = require("../../test/testModules/utils.js")

module.exports = [
  "Diversified USD",
  "DFiUSD",
  "0x00890D5630f8e46aCFabDE50cD260acc5c605D33",//timelock controller
  "0x8978F3A0227453Dd0821bC8A85e4bEF96DAF8327",//reserve manager
  ["0xD5ade97228C6d11B25aDc8A50AFc2d73fEEa2D8D"],//maintainers
  43200,//12 hour minimum balance change delay
  utils.decimalToFixed(1.0000027639846123)//equivalent to 1.01 max change per hour
]