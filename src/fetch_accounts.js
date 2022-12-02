const { initNear } = require("./libs/near");

const Big = require("big.js");
const { keysToCamel, bigMin } = require("./libs/utils");
const { parseAsset } = require("./libs/asset");
const { parsePriceData } = require("./libs/priceData");
const { parseAccount, processAccount } = require("./libs/account");
const { refSell, refBuy } = require("./libs/refExchange");
const fs = require("fs");
const { PromisePool } = require("@supercharge/promise-pool");

Big.DP = 27;

async function main(nearObjects, rebalance) {
  const { tokenContract, burrowContract, priceOracleContract, NearConfig } =
    nearObjects;

  const rawAssets = keysToCamel(await burrowContract.get_assets_paged());
  const assets = rawAssets.reduce((assets, [assetId, asset]) => {
    assets[assetId] = parseAsset(asset);
    return assets;
  }, {});

  const prices = parsePriceData(
    keysToCamel(
      await priceOracleContract.get_price_data({
        asset_ids: Object.keys(assets),
      })
    )
  );

  const numAccounts = parseInt(await burrowContract.get_num_accounts());
  console.log("Num accounts: ", numAccounts);
  const limit = 100;

  const promises = [];
  for (let i = 0; i < numAccounts; i += limit) {
    promises.push(burrowContract.get_accounts_paged({ from_index: i, limit }));
  }

  const accountIds = (await Promise.all(promises))
    .flat()
    .map((a) => keysToCamel(a).accountId);

  console.log(`Fetched ${accountIds.length} account IDs`);

  let n = 0;

  const { results, errors } = await PromisePool.withConcurrency(8)
    .for(accountIds)
    .process(async (accountId) => {
      const rawAccount = await burrowContract.get_account({
        account_id: accountId,
      });
      const account = processAccount(
        parseAccount(keysToCamel(rawAccount)),
        assets,
        prices
      );
      n++;
      if (n % 50 === 0) {
        console.log("Progress", n);
      }
      account.rawAccount = rawAccount;
      return account;
    });
  fs.writeFile("accounts.json", JSON.stringify(results), function (err) {
    if (err) {
      console.log(err);
    } else {
      console.log(`File "accounts.json" saved`);
    }
  });

  fs.writeFile("errors.json", JSON.stringify(errors), function (err) {
    if (err) {
      console.log(err);
    } else {
      console.log(`File "errors.json" saved`);
    }
  });
  return;
}

initNear(true, process.env.KEY_PATH || null).then((nearObject) =>
  main(nearObject, true)
);
