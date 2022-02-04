const Big = require("big.js");
const _ = require("lodash");
const fs = require("fs");
const { keysToCamel } = require("./utils");
const { parseAsset } = require("./asset");
const { parsePriceData } = require("./priceData");
const {
  parseAccount,
  processAccount,
  computeLiquidation,
} = require("./account");

Big.DP = 27;

module.exports = {
  main: async (nearObjects, liquidate) => {
    const {
      near,
      account,
      tokenContract,
      refFinanceContract,
      burrowContract,
      priceOracleContract,
      NearConfig,
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

    console.log("Num accounts: ", numAccounts);
    const limit = 100;

    const promises = [];
    for (let i = 0; i < numAccounts; i += limit) {
      promises.push(
        burrowContract.get_accounts_paged({ from_index: i, limit })
      );
    }
    const accounts = (await Promise.all(promises))
      .flat()
      .map((a) => processAccount(parseAccount(keysToCamel(a)), assets, prices))
      .filter((a) => !!a.healthFactor);

    accounts.sort((a, b) => {
      return a.healthFactor.cmp(b.healthFactor);
    });

    console.log(
      accounts
        .filter((a) => a.healthFactor.lt(2))
        .map((a) => `${a.accountId} -> ${a.healthFactor.mul(100).toFixed(2)}%`)
    );
    // console.log(JSON.stringify(accounts, undefined, 2));

    const accountsWithDebt = accounts.filter((a) => a.discount.gt(0));

    accountsWithDebt.sort((a, b) => {
      return b.discount.cmp(a.discount);
    });

    if (accountsWithDebt.length > 0 && liquidate) {
      const { liquidationAction, totalPricedProfit } = computeLiquidation(
        accountsWithDebt[0]
      );
      if (totalPricedProfit.gt(Big(2).div(100))) {
        console.log("Executing liquidation");
        const msg = JSON.stringify({
          Execute: {
            actions: [
              {
                Liquidate: liquidationAction,
              },
            ],
          },
        });
        await priceOracleContract.oracle_call(
          {
            receiver_id: NearConfig.burrowContractId,
            asset_ids: Object.keys(assets),
            msg,
          },
          Big(10).pow(12).mul(300).toFixed(0),
          "1"
        );
      } else {
        console.log("The liquidation profit is too small");
      }
    }

    return {
      numAccounts,
      accounts: JSON.stringify(accounts, undefined, 2),
      accountsWithDebt: JSON.stringify(accountsWithDebt, undefined, 2),
    };
  },
};
