/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/strata.json`.
 */
export type Strata = {
  "address": "2KXPBww71SmCwdh4MAZ8P8UdpkzmFx8eNFd1437Hbw8s",
  "metadata": {
    "name": "strata",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Strata: Solana launches with an on-chain SOL reserve and a floor that only goes up"
  },
  "instructions": [
    {
      "name": "buy",
      "discriminator": [
        102,
        6,
        61,
        18,
        1,
        218,
        235,
        234
      ],
      "accounts": [
        {
          "name": "buyer",
          "writable": true,
          "signer": true
        },
        {
          "name": "launch",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  97,
                  117,
                  110,
                  99,
                  104
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "mint",
          "writable": true,
          "relations": [
            "launch"
          ]
        },
        {
          "name": "reserveVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  115,
                  101,
                  114,
                  118,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "launch"
              }
            ]
          }
        },
        {
          "name": "curveVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  117,
                  114,
                  118,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "launch"
              }
            ]
          }
        },
        {
          "name": "creatorFeeVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  114,
                  101,
                  97,
                  116,
                  111,
                  114,
                  95,
                  102,
                  101,
                  101,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "launch"
              }
            ]
          }
        },
        {
          "name": "buyerToken",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "lamportsIn",
          "type": "u64"
        },
        {
          "name": "minTokensOut",
          "type": "u64"
        }
      ]
    },
    {
      "name": "claimCreatorFees",
      "discriminator": [
        0,
        23,
        125,
        234,
        156,
        118,
        134,
        89
      ],
      "accounts": [
        {
          "name": "creator",
          "writable": true,
          "signer": true,
          "relations": [
            "launch"
          ]
        },
        {
          "name": "launch"
        },
        {
          "name": "creatorFeeVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  114,
                  101,
                  97,
                  116,
                  111,
                  114,
                  95,
                  102,
                  101,
                  101,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "launch"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "claimVested",
      "discriminator": [
        208,
        190,
        166,
        114,
        203,
        225,
        140,
        208
      ],
      "accounts": [
        {
          "name": "creator",
          "signer": true,
          "relations": [
            "launch"
          ]
        },
        {
          "name": "launch",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  97,
                  117,
                  110,
                  99,
                  104
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "mint",
          "relations": [
            "launch"
          ]
        },
        {
          "name": "vestEscrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  101,
                  115,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "launch"
              }
            ]
          }
        },
        {
          "name": "creatorToken",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "creatorBuy",
      "docs": [
        "The creator's optional first buy, before anyone else. Vests if the launch says so."
      ],
      "discriminator": [
        73,
        28,
        100,
        36,
        99,
        99,
        116,
        197
      ],
      "accounts": [
        {
          "name": "creator",
          "writable": true,
          "signer": true,
          "relations": [
            "launch"
          ]
        },
        {
          "name": "launch",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  97,
                  117,
                  110,
                  99,
                  104
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "mint",
          "writable": true,
          "relations": [
            "launch"
          ]
        },
        {
          "name": "reserveVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  115,
                  101,
                  114,
                  118,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "launch"
              }
            ]
          }
        },
        {
          "name": "curveVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  117,
                  114,
                  118,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "launch"
              }
            ]
          }
        },
        {
          "name": "creatorFeeVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  114,
                  101,
                  97,
                  116,
                  111,
                  114,
                  95,
                  102,
                  101,
                  101,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "launch"
              }
            ]
          }
        },
        {
          "name": "creatorToken",
          "docs": [
            "Receives the tokens when the launch has no vesting."
          ],
          "writable": true
        },
        {
          "name": "vestEscrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  101,
                  115,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "launch"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "lamportsIn",
          "type": "u64"
        },
        {
          "name": "minTokensOut",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initializeLaunch",
      "docs": [
        "Create a launch: mint, metadata, the launch account and its three vaults."
      ],
      "discriminator": [
        90,
        201,
        220,
        142,
        112,
        253,
        100,
        13
      ],
      "accounts": [
        {
          "name": "creator",
          "writable": true,
          "signer": true
        },
        {
          "name": "mint",
          "writable": true,
          "signer": true
        },
        {
          "name": "launch",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  97,
                  117,
                  110,
                  99,
                  104
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "reserveVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  115,
                  101,
                  114,
                  118,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "launch"
              }
            ]
          }
        },
        {
          "name": "curveVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  117,
                  114,
                  118,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "launch"
              }
            ]
          }
        },
        {
          "name": "creatorFeeVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  114,
                  101,
                  97,
                  116,
                  111,
                  114,
                  95,
                  102,
                  101,
                  101,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "launch"
              }
            ]
          }
        },
        {
          "name": "metadata",
          "writable": true
        },
        {
          "name": "treasury",
          "writable": true,
          "address": "HSvcPoLcbTX7d2xSLU1HWDvNnqBPbhFDT64weAWnNBfT"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "tokenMetadataProgram",
          "address": "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "launchArgs"
            }
          }
        }
      ]
    },
    {
      "name": "redeem",
      "docs": [
        "Redeem at the floor: tokens burn, the reserve pays."
      ],
      "discriminator": [
        184,
        12,
        86,
        149,
        70,
        196,
        97,
        225
      ],
      "accounts": [
        {
          "name": "holder",
          "writable": true,
          "signer": true
        },
        {
          "name": "launch",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  97,
                  117,
                  110,
                  99,
                  104
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "mint",
          "writable": true,
          "relations": [
            "launch"
          ]
        },
        {
          "name": "reserveVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  115,
                  101,
                  114,
                  118,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "launch"
              }
            ]
          }
        },
        {
          "name": "curveVault",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  117,
                  114,
                  118,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "launch"
              }
            ]
          }
        },
        {
          "name": "holderToken",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "tokens",
          "type": "u64"
        },
        {
          "name": "minLamportsOut",
          "type": "u64"
        }
      ]
    },
    {
      "name": "sell",
      "docs": [
        "Sell, routed: the curve while it pays at least the floor, then redemption."
      ],
      "discriminator": [
        51,
        230,
        133,
        164,
        1,
        127,
        131,
        173
      ],
      "accounts": [
        {
          "name": "seller",
          "writable": true,
          "signer": true
        },
        {
          "name": "launch",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  97,
                  117,
                  110,
                  99,
                  104
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "mint",
          "writable": true,
          "relations": [
            "launch"
          ]
        },
        {
          "name": "reserveVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  115,
                  101,
                  114,
                  118,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "launch"
              }
            ]
          }
        },
        {
          "name": "curveVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  117,
                  114,
                  118,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "launch"
              }
            ]
          }
        },
        {
          "name": "creatorFeeVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  114,
                  101,
                  97,
                  116,
                  111,
                  114,
                  95,
                  102,
                  101,
                  101,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "launch"
              }
            ]
          }
        },
        {
          "name": "sellerToken",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "tokensIn",
          "type": "u64"
        },
        {
          "name": "minLamportsOut",
          "type": "u64"
        }
      ]
    },
    {
      "name": "syncReserve",
      "docs": [
        "Permissionless: fold untracked vault lamports (donations) into the drip."
      ],
      "discriminator": [
        127,
        186,
        191,
        188,
        234,
        217,
        118,
        250
      ],
      "accounts": [
        {
          "name": "launch",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  97,
                  117,
                  110,
                  99,
                  104
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "mint",
          "relations": [
            "launch"
          ]
        },
        {
          "name": "reserveVault",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  115,
                  101,
                  114,
                  118,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "launch"
              }
            ]
          }
        },
        {
          "name": "curveVault",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  117,
                  114,
                  118,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "launch"
              }
            ]
          }
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "launch",
      "discriminator": [
        144,
        51,
        51,
        163,
        206,
        85,
        213,
        38
      ]
    },
    {
      "name": "vault",
      "discriminator": [
        211,
        8,
        232,
        43,
        2,
        152,
        117,
        119
      ]
    }
  ],
  "events": [
    {
      "name": "launchCreated",
      "discriminator": [
        59,
        38,
        190,
        230,
        33,
        34,
        89,
        20
      ]
    },
    {
      "name": "trade",
      "discriminator": [
        24,
        254,
        218,
        152,
        253,
        43,
        18,
        81
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidName",
      "msg": "Name must be 1 to 32 characters"
    },
    {
      "code": 6001,
      "name": "invalidTicker",
      "msg": "Ticker must be 2 to 10 uppercase letters or digits"
    },
    {
      "code": 6002,
      "name": "invalidUri",
      "msg": "Metadata URI is too long"
    },
    {
      "code": 6003,
      "name": "invalidSetting",
      "msg": "A launch setting is outside its allowed range"
    },
    {
      "code": 6004,
      "name": "invalidDelay",
      "msg": "Redemption delay must be one of the allowed options"
    },
    {
      "code": 6005,
      "name": "slippage",
      "msg": "Result is worse than the slippage limit"
    },
    {
      "code": 6006,
      "name": "redemptionNotOpen",
      "msg": "Redemption is not open yet for this launch"
    },
    {
      "code": 6007,
      "name": "firstBuyUnavailable",
      "msg": "The creator's first buy has already happened or someone bought first"
    },
    {
      "code": 6008,
      "name": "firstBuyTooLarge",
      "msg": "First buy is larger than allowed"
    },
    {
      "code": 6009,
      "name": "nothingToClaim",
      "msg": "Nothing to claim yet"
    },
    {
      "code": 6010,
      "name": "vestingNotEnabled",
      "msg": "This launch has no vesting"
    },
    {
      "code": 6011,
      "name": "overflow",
      "msg": "Arithmetic overflow"
    },
    {
      "code": 6012,
      "name": "zeroOutput",
      "msg": "Amount too small to produce any tokens"
    },
    {
      "code": 6013,
      "name": "belowMinBuy",
      "msg": "Buy is below the minimum"
    },
    {
      "code": 6014,
      "name": "floorDilution",
      "msg": "Buy would not back its new tokens at the floor"
    },
    {
      "code": 6015,
      "name": "curveExhausted",
      "msg": "The curve has no tokens left"
    },
    {
      "code": 6016,
      "name": "invalidAmount",
      "msg": "Invalid token amount"
    },
    {
      "code": 6017,
      "name": "dustRedemption",
      "msg": "Redemption would pay zero lamports"
    },
    {
      "code": 6018,
      "name": "residualSupplyTooSmall",
      "msg": "Would leave circulating supply above zero but below the minimum"
    },
    {
      "code": 6019,
      "name": "floorDecreased",
      "msg": "Invariant: floor would decrease"
    },
    {
      "code": 6020,
      "name": "reserveWithoutSupply",
      "msg": "Invariant: reserve left behind zero supply"
    },
    {
      "code": 6021,
      "name": "curveInsolvent",
      "msg": "Invariant: curve vault accounting mismatch"
    },
    {
      "code": 6022,
      "name": "curveKDecreased",
      "msg": "Invariant: curve k decreased"
    },
    {
      "code": 6023,
      "name": "vaultUnderfunded",
      "msg": "Invariant: reserve vault holds less than it owes"
    },
    {
      "code": 6024,
      "name": "supplyMismatch",
      "msg": "Invariant: mint supply differs from tracked supply"
    },
    {
      "code": 6025,
      "name": "invalidMetadataAccount",
      "msg": "Wrong metadata account"
    }
  ],
  "types": [
    {
      "name": "bucket",
      "docs": [
        "Hourly or daily close, for charts and 24h volume without an indexer."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pricePerM",
            "docs": [
              "Lamports per 1M tokens at the close of the bucket."
            ],
            "type": "u64"
          },
          {
            "name": "floorPerM",
            "type": "u64"
          },
          {
            "name": "volume",
            "docs": [
              "Lamports traded in the bucket."
            ],
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "launch",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "version",
            "type": "u8"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "reserveBump",
            "type": "u8"
          },
          {
            "name": "curveBump",
            "type": "u8"
          },
          {
            "name": "creatorFeesBump",
            "type": "u8"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "reserveShareBps",
            "type": "u16"
          },
          {
            "name": "feeToReserveBps",
            "type": "u16"
          },
          {
            "name": "creatorFeeBps",
            "type": "u16"
          },
          {
            "name": "vestingDays",
            "type": "u16"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "redemptionOpensAt",
            "type": "i64"
          },
          {
            "name": "firstBuyDone",
            "type": "bool"
          },
          {
            "name": "pool",
            "type": {
              "defined": {
                "name": "poolState"
              }
            }
          },
          {
            "name": "vestTotal",
            "type": "u64"
          },
          {
            "name": "vestClaimed",
            "type": "u64"
          },
          {
            "name": "vestStart",
            "type": "i64"
          },
          {
            "name": "creatorFeesTotal",
            "type": "u64"
          },
          {
            "name": "floorRaises",
            "type": "u64"
          },
          {
            "name": "redeemedBase",
            "type": "u64"
          },
          {
            "name": "redeemedLamports",
            "type": "u64"
          },
          {
            "name": "feesToReserve",
            "type": "u64"
          },
          {
            "name": "volumeTotal",
            "type": "u64"
          },
          {
            "name": "trades",
            "type": "u64"
          },
          {
            "name": "hourIndex",
            "type": "i64"
          },
          {
            "name": "dayIndex",
            "type": "i64"
          },
          {
            "name": "hourly",
            "type": {
              "array": [
                {
                  "defined": {
                    "name": "bucket"
                  }
                },
                48
              ]
            }
          },
          {
            "name": "daily",
            "type": {
              "array": [
                {
                  "defined": {
                    "name": "bucket"
                  }
                },
                32
              ]
            }
          },
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "ticker",
            "type": "string"
          },
          {
            "name": "uri",
            "type": "string"
          }
        ]
      }
    },
    {
      "name": "launchArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "ticker",
            "type": "string"
          },
          {
            "name": "uri",
            "docs": [
              "Off-chain metadata JSON (image, description). May be empty."
            ],
            "type": "string"
          },
          {
            "name": "reserveShareBps",
            "type": "u16"
          },
          {
            "name": "feeToReserveBps",
            "type": "u16"
          },
          {
            "name": "creatorFeeBps",
            "type": "u16"
          },
          {
            "name": "vestingDays",
            "docs": [
              "0 = no vesting on the creator's first buy."
            ],
            "type": "u16"
          },
          {
            "name": "redemptionDelayHours",
            "type": "u32"
          }
        ]
      }
    },
    {
      "name": "launchCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "launch",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "ticker",
            "type": "string"
          },
          {
            "name": "ts",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "poolState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vSol",
            "type": "u64"
          },
          {
            "name": "vTokens",
            "type": "u64"
          },
          {
            "name": "curveLamports",
            "type": "u64"
          },
          {
            "name": "reserve",
            "type": "u64"
          },
          {
            "name": "supply",
            "type": "u64"
          },
          {
            "name": "hwmReserve",
            "type": "u64"
          },
          {
            "name": "hwmSupply",
            "type": "u64"
          },
          {
            "name": "pending",
            "type": "u64"
          },
          {
            "name": "dripLastSlot",
            "type": "u64"
          },
          {
            "name": "dripUntilSlot",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "trade",
      "docs": [
        "One per buy, sell or redeem. The UI's activity feed reads these."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "launch",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "kind",
            "type": "u8"
          },
          {
            "name": "lamports",
            "docs": [
              "Lamports paid in (buy) or out (sell, redeem)."
            ],
            "type": "u64"
          },
          {
            "name": "tokens",
            "type": "u64"
          },
          {
            "name": "redeemedTokens",
            "docs": [
              "Of a sell, how many tokens went to the redemption leg."
            ],
            "type": "u64"
          },
          {
            "name": "pricePerM",
            "type": "u64"
          },
          {
            "name": "floorPerM",
            "type": "u64"
          },
          {
            "name": "reserve",
            "type": "u64"
          },
          {
            "name": "supply",
            "type": "u64"
          },
          {
            "name": "ts",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "vault",
      "docs": [
        "A program-owned lamport holder. Only strata code can debit it, and only",
        "`common::pay_from_reserve` debits the reserve vault."
      ],
      "type": {
        "kind": "struct",
        "fields": []
      }
    }
  ]
};
