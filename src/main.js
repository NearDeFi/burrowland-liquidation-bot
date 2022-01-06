#!/usr/bin/env node

const nearAPI = require("near-api-js");
const { initNear } = require("./near");
const Big = require("big.js");
const _ = require("lodash");
const fs = require("fs");
const { keysToCamel } = require("./utils");
const { parseAsset } = require("./asset");
const { parsePriceData } = require("./priceData");
const { parseAccount, processAccount } = require("./account");

Big.DP = 27;

const main = async (nearObjects) => {
  const {
    near,
    account,
    tokenContract,
    refFinanceContract,
    burrowContract,
    priceOracleContract,
  } = nearObjects;

  const rawAssets = keysToCamel(await burrowContract.get_assets_paged());
  const assets = rawAssets.reduce((assets, [assetId, asset]) => {
    assets[assetId] = parseAsset(asset);
    return assets;
  }, {});
  // console.log(assets);

  const [rawPriceData, numAccounts] = (
    await Promise.all([
      priceOracleContract.get_price_data({
        asset_ids: Object.keys(assets),
      }),
      burrowContract.get_num_accounts(),
    ])
  ).map(keysToCamel);

  const prices = parsePriceData(rawPriceData);

  // console.log(prices);
  console.log("Num accounts: ", numAccounts);

  // Load oracle prices
  // Load assets
  // Load accounts

  const accounts = keysToCamel(
    await burrowContract.get_accounts_paged({ limit: 100 })
  )
    .map((a) => processAccount(parseAccount(a), assets, prices))
    .filter((a) => !!a.healthFactor);

  accounts.sort((a, b) => {
    return a.healthFactor.cmp(b.healthFactor);
  });

  console.log(JSON.stringify(accounts, undefined, 2));

  const accountsWithDebt = accounts.filter((a) => a.discount.gt(0));

  accountsWithDebt.sort((a, b) => {
    return a.discount.cmp(b.discount);
  });

  console.log(JSON.stringify(accountsWithDebt, undefined, 2));
};

initNear().then(main);
