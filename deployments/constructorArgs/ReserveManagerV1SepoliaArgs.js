module.exports = [
  "0x0F688325E86eDf0d0Da187f436a46C47C8F6CDC3",//TimelockController address
  "0xD5ade97228C6d11B25aDc8A50AFc2d73fEEa2D8D",//multisig admin address
  "0xDF10bE61122b11c89238445783b5b9DBfddE0EBf",//indexToken address
  0,//mint fee
  0,//burn fee
  100000000000000000000000000n,//initial max reserves
  31691265005705736556118016n,//initial max reserves increase rate per hour
  [//initial asset params
    [
      '0xa814D1722125151c1BcD363E79a60d59BFb8F53e',
      123794003928538034361860096n,
      18
    ],
    [
      '0x1537e0CD1eAC6Dc732d0847139d9eACAEc323Db0',
      108319753437470767181725696n,
      20
    ],
    [
      '0x8E9c43c72ab3a49Fdd242e5BB44B337e94979dd1',
      77371252455336267181195263n,
      6
    ]
  ]
]