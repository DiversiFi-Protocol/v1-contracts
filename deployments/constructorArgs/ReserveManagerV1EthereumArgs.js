const initialAssetParams = require("../initialAssetParams")

module.exports = [
  "0x00890D5630f8e46aCFabDE50cD260acc5c605D33",//TimelockController address
  "0xD5ade97228C6d11B25aDc8A50AFc2d73fEEa2D8D",//multisig admin address
  "0xDF100b8ABd3cd41fC5cC1236AD7c6629A901AfBf",//indexToken address
  0,//mint fee
  0,//burn fee
  100000000000000000000000000n,//initial max reserves
  31691265005705736556118016n,//initial max reserves increase rate per hour
  initialAssetParams
]