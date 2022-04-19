#!/usr/bin/env node

const nearAPI = require("near-api-js");
const { initNear } = require("./libs/near");
const Big = require("big.js");
const _ = require("lodash");
const fs = require("fs");
const {
  keysToCamel,
  parseTimestamp,
  parseRatio,
  parseRate,
} = require("./libs/utils");
const { parseAsset } = require("./libs/asset");
const { parsePriceData } = require("./libs/priceData");
const {
  parseAccount,
  processAccount,
  computeLiquidation,
} = require("./libs/account");

Big.DP = 27;

const mainTest = () => {
  const assets = {
    NEAR: {
      supplied: {
        balance: Big(10).pow(24).mul(10000),
        shares: Big(10).pow(24).mul(10000),
      },
      borrowed: {
        balance: Big(10).pow(24).mul(10000),
        shares: Big(10).pow(24).mul(10000),
      },
      reserved: Big(0),
      config: {
        volatilityRatio: parseRatio(6000),
        extraDecimals: 0,
      },
    },
    USDC: {
      supplied: {
        balance: Big(10).pow(18).mul(10000),
        shares: Big(10).pow(18).mul(10000),
      },
      borrowed: {
        balance: Big(10).pow(18).mul(10000),
        shares: Big(10).pow(18).mul(10000),
      },
      reserved: Big(0),
      config: {
        volatilityRatio: parseRatio(9500),
        extraDecimals: 12,
      },
    },
    DAI: {
      supplied: {
        balance: Big(10).pow(18).mul(10000),
        shares: Big(10).pow(18).mul(10000),
      },
      borrowed: {
        balance: Big(10).pow(18).mul(10000),
        shares: Big(10).pow(18).mul(10000),
      },
      reserved: Big(0),
      config: {
        volatilityRatio: parseRatio(9500),
        extraDecimals: 0,
      },
    },
  };

  const prices = {
    prices: {
      NEAR: {
        multiplier: Big(200000),
        decimals: 28,
      },
      USDC: {
        multiplier: Big(10000),
        decimals: 10,
      },
      DAI: {
        multiplier: Big(10000),
        decimals: 22,
      },
    },
  };

  const accounts = [
    {
      accountId: "alice",
      collateral: [
        {
          tokenId: "NEAR",
          shares: Big(10).pow(24).mul(7),
        },
      ],
      borrowed: [
        {
          tokenId: "DAI",
          shares: Big(10).pow(18).mul(50),
        },
      ],
    },
    {
      accountId: "rekt",
      collateral: [
        {
          tokenId: "NEAR",
          shares: Big(10).pow(24).mul(5),
        },
        {
          tokenId: "USDC",
          shares: Big(10).pow(18).mul(20),
        },
      ],
      borrowed: [
        {
          tokenId: "DAI",
          shares: Big(10).pow(18).mul(100),
        },
      ],
    },
    {
      accountId: "bob",
      collateral: [
        {
          tokenId: "NEAR",
          shares: Big(10).pow(24).mul(7).sub(Big("3049877847073640764176570")),
        },
      ],
      borrowed: [
        {
          tokenId: "DAI",
          shares: Big(10).pow(18).mul(100).sub(Big("54867607456639504711")),
        },
      ],
    },
  ]
    .map((a) => processAccount(a, assets, prices))
    .filter((a) => !!a.healthFactor);

  accounts.sort((a, b) => {
    return a.healthFactor.cmp(b.healthFactor);
  });

  console.log(
    accounts.map(
      (a) =>
        `${a.accountId} -> health ${a.healthFactor
          .mul(100)
          .toFixed(2)}% discount ${a.discount.mul(100).toFixed(2)}%`
    )
  );
  // console.log(JSON.stringify(accounts, undefined, 2));

  const accountsWithDebt = accounts.filter((a) => a.discount.gt(0));

  accountsWithDebt.sort((a, b) => {
    return b.discount.cmp(a.discount);
  });

  if (accountsWithDebt.length > 0) {
    computeLiquidation(accountsWithDebt[0]);
  }

  // console.log(JSON.stringify(accountsWithDebt, undefined, 2));
};

mainTest();
