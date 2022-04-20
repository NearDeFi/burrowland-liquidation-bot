const { initNear } = require("./libs/near");

const Big = require("big.js");
const { keysToCamel, bigMin } = require("./libs/utils");
const { parseAsset } = require("./libs/asset");
const { parsePriceData } = require("./libs/priceData");
const { parseAccount, processAccount } = require("./libs/account");
const { refSell, refBuy } = require("./libs/refExchange");

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

  const burrowAccount = processAccount(
    parseAccount(
      keysToCamel(
        await burrowContract.get_account({
          account_id: NearConfig.accountId,
        })
      )
    ),
    assets,
    prices
  );

  // console.log(JSON.stringify(burrowAccount, null, 2));

  const repayingActions = [];
  // Trying to repay first
  burrowAccount.borrowed
    .filter((b) => b.pricedBalance?.gt(NearConfig.minRepayAmount))
    .forEach((b) => {
      const s = burrowAccount.supplied.find((s) => s.tokenId === b.tokenId);
      if (s && s.pricedBalance.gt(NearConfig.minRepayAmount)) {
        const amount = bigMin(b.balance, s.balance);
        console.log(`Repaying ${b.tokenId} amount ${amount.toFixed(0)}`);
        repayingActions.push({
          Repay: {
            token_id: b.tokenId,
            max_amount: s.balance.toFixed(0),
          },
        });
      }
    });

  if (repayingActions.length > 0) {
    // Going to withdraw and swap
    await burrowContract.execute(
      {
        actions: repayingActions,
      },
      Big(10).pow(12).mul(300).toFixed(0),
      "1"
    );
    return main(nearObjects, rebalance);
  }

  // TODO: Attempt to sell non-sold tokens.
  for (let i = 0; i < burrowAccount.supplied.length; ++i) {
    const s = burrowAccount.supplied[i];
    if (s.pricedBalance?.gt(NearConfig.minSwapAmount)) {
      console.log(`Withdrawing ${s.tokenId} amount ${s.balance.toFixed(0)}`);
      // Going to withdraw and swap
      await burrowContract.execute(
        {
          actions: [
            {
              Withdraw: {
                token_id: s.tokenId,
                amount: s.balance.toFixed(0),
              },
            },
          ],
        },
        Big(10).pow(12).mul(300).toFixed(0),
        "1"
      );
      console.log(`Selling ${s.tokenId} amount ${s.balance.toFixed(0)}`);
      // Swapping this asset for wNEAR
      await refSell(nearObjects, s.tokenId, s.tokenBalance);
      return main(nearObjects, rebalance);
    }
  }

  // Buying borrowed assets to repay
  for (let i = 0; i < burrowAccount.borrowed.length; ++i) {
    const b = burrowAccount.borrowed[i];
    if (b.pricedBalance?.gt(NearConfig.minSwapAmount)) {
      console.log(`Buying ${b.tokenId} amount ${b.balance.toFixed(0)}`);
      // Buying this asset for wNEAR
      await refBuy(nearObjects, b.tokenId, b.tokenBalance);

      console.log(`Depositing ${b.tokenId} amount ${b.balance.toFixed(0)}`);
      const token = tokenContract(b.tokenId);
      await token.ft_transfer_call(
        {
          receiver_id: NearConfig.burrowContractId,
          amount: b.tokenBalance.toFixed(0),
          msg: "",
        },
        Big(10).pow(12).mul(300).toFixed(0),
        "1"
      );
      return main(nearObjects, rebalance);
    }
  }
}

// TODO: Add custom accountPath for rebalancing with a different key
initNear(true, process.env.KEY_PATH || null).then((nearObject) =>
  main(nearObject, true)
);
