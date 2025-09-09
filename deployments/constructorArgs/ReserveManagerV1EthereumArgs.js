const initialAssetParams = require("../initialAssetParams")

module.exports = [
  "0x0F688325E86eDf0d0Da187f436a46C47C8F6CDC3",//TimelockController address
  "0x0F688325E86eDf0d0Da187f436a46C47C8F6CDC3",//multisig admin address
  "0xDF10bE61122b11c89238445783b5b9DBfddE0EBf",//indexToken address
  0,//mint fee
  0,//burn fee
  100000000000000000000000000n,//initial max reserves
  31691265005705736556118016n,//initial max reserves increase rate per hour
  initialAssetParams
]