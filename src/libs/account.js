const Big = require("big.js");
const { bigMin } = require("./utils");

const volatilityRatioCmp = (a, b) =>
  b.asset.config.volatilityRatio.cmp(a.asset.config.volatilityRatio);

const parseAccountAsset = (a) => {
  return {
    tokenId: a.tokenId,
    shares: Big(a.shares),
    balance: a.balance ? Big(a.balance) : null,
  };
};

const parseAccount = (a) => {
  return {
    accountId: a.accountId,
    collateral: a.collateral.map(parseAccountAsset),
    borrowed: a.borrowed.map(parseAccountAsset),
    supplied: a.supplied?.map(parseAccountAsset),
  };
};

const processAccountAsset = (a, assets, prices, supplied) => {
  const asset = assets[a.tokenId];
  const pool = supplied ? asset.supplied : asset.borrowed;
  const price = prices?.prices[a.tokenId];
  a.asset = asset;
  a.price = price;
  a.balance = pool.balance
    .mul(a.shares)
    .div(pool.shares)
    .round(0, supplied ? 0 : 3);
  a.tokenBalance = a.balance
    .div(Big(10).pow(asset.config.extraDecimals))
    .round(0, supplied ? 0 : 3);
  a.pricedBalance = price
    ? a.balance
        .mul(price.multiplier)
        .div(Big(10).pow(price.decimals + asset.config.extraDecimals))
    : null;
  a.adjustedPricedBalance = price
    ? supplied
      ? a.pricedBalance.mul(asset.config.volatilityRatio)
      : a.pricedBalance.div(asset.config.volatilityRatio)
    : null;
  return a;
};

const assetAdjustedPricedSum = (aa) =>
  aa.reduce(
    (acc, a) =>
      a.adjustedPricedBalance && acc ? acc.add(a.adjustedPricedBalance) : null,
    Big(0)
  );

const assetPricedSum = (aa) =>
  aa.reduce(
    (acc, a) => (a.pricedBalance && acc ? acc.add(a.pricedBalance) : null),
    Big(0)
  );

const recomputeAccountDiscount = (account) => {
  if (account.adjustedBorrowedSum && account.adjustedCollateralSum) {
    account.adjustedDebt = account.adjustedBorrowedSum.sub(
      account.adjustedCollateralSum
    );
    account.healthFactor = account.adjustedBorrowedSum.gt(0)
      ? account.adjustedCollateralSum.div(account.adjustedBorrowedSum)
      : Big(1e9);
    account.discount = account.adjustedDebt.gt(0)
      ? account.adjustedDebt.div(account.adjustedBorrowedSum).div(2)
      : Big(0);
  }
};

const processAccount = (account, assets, prices) => {
  account.collateral.forEach(
    (a) => (a = processAccountAsset(a, assets, prices, true))
  );
  account.collateralSum = assetPricedSum(account.collateral);
  account.adjustedCollateralSum = assetAdjustedPricedSum(account.collateral);
  account.borrowed.forEach((a) =>
    processAccountAsset(a, assets, prices, false)
  );
  account.supplied?.forEach((a) =>
    processAccountAsset(a, assets, prices, true)
  );
  account.borrowedSum = assetPricedSum(account.borrowed);
  account.adjustedBorrowedSum = assetAdjustedPricedSum(account.borrowed);
  recomputeAccountDiscount(account);

  return account;
};

const computeLiquidation = (
  account,
  maxLiquidationAmount = Big(10).pow(18),
  maxWithdrawCount = 0
) => {
  // When liquidating, it's beneficial to take collateral with higher volatilityRatio first, because
  // it will decrease the adjustedCollateralSum less. Similarly it's more beneficial to
  // repay debt with higher volatilityRatio first, because it'll decrease adjustedBorrowedSum less.
  account.collateral.sort(volatilityRatioCmp);
  account.borrowed.sort(volatilityRatioCmp);
  // Liquidation rules:
  // 1) Taken discounted collateral, should be less than the repaid debt
  // 2) The new health factor should still be less than 100%.
  // We can claim all collateral, but can't repay all debt.

  // Debt 100 DAI at 95% vol             -> 100$ deb -> 105.26$ adj debt
  // Collateral 7 NEAR at 20$ at 60% vol -> 140$ col -> 84$ adj col
  // Health factor: 0.798
  // Discount: 0.101

  const collateralAssets = [];
  const borrowedAssets = [];

  let collateralIndex = 0;
  let borrowedIndex = 0;
  const origHealth = account.healthFactor;
  const origDiscount = account.discount;
  const discountMul = Big(1).sub(account.discount);
  const maxHealthFactor = Big(995).div(1000);
  const minPricedBalance = Big(1).div(100);
  let totalPricedProfit = Big(0);
  let totalPricedAmount = Big(0);
  while (
    collateralIndex < account.collateral.length &&
    borrowedIndex < account.borrowed.length &&
    account.healthFactor.lt(maxHealthFactor) &&
    totalPricedAmount.lt(maxLiquidationAmount)
  ) {
    const collateral = account.collateral[collateralIndex];

    if (collateral.pricedBalance.lt(minPricedBalance)) {
      collateralIndex++;
      continue;
    }

    const borrowed = account.borrowed[borrowedIndex];

    if (borrowed.pricedBalance.lt(minPricedBalance)) {
      borrowedIndex++;
      continue;
    }

    const discountedPricedBalance = collateral.pricedBalance.mul(discountMul);
    const maxPricedAmount = bigMin(
      bigMin(discountedPricedBalance, borrowed.pricedBalance),
      maxLiquidationAmount.sub(totalPricedAmount)
    );
    // Need to compute pricedAmount that the new health factor still less than 100%
    // adjColSum - X / discountMul * col_vol(60%) = adjBorSum - X / bor_vol(95%)
    // adjBorSum - adjColSum = X * 1 / bor_vol - X * col_vol / discountMul
    // adjBorSum - adjColSum = X * (1 / bor_vol - col_vol / discountMul)
    // X = (adjBorSum - adjColSum) / (1 / bor_vol - col_vol / discountMul)
    const denom = Big(1)
      .div(borrowed.asset.config.volatilityRatio)
      .sub(collateral.asset.config.volatilityRatio.div(discountMul));
    const maxHealthAmount = denom.gt(0)
      ? account.adjustedBorrowedSum
          .sub(account.adjustedCollateralSum)
          .div(denom)
      : maxPricedAmount.mul(2);

    const pricedAmount = bigMin(maxHealthAmount, maxPricedAmount);
    totalPricedAmount = totalPricedAmount.add(pricedAmount);

    const collateralPricedAmount = pricedAmount.div(discountMul);

    const pricedProfit = collateralPricedAmount.sub(pricedAmount);
    // console.log(
    //   `Profit $${collateralPricedAmount.toFixed(2)} of ${
    //     tokenIdToName(collateral.tokenId)
    //   } -> $${pricedAmount.toFixed(2)} of ${
    //     tokenIdToName(borrowed.tokenId)
    //   }: $${pricedProfit.toFixed(2)}`
    // );
    totalPricedProfit = totalPricedProfit.add(pricedProfit);

    const collateralAmount = collateralPricedAmount
      .div(collateral.price.multiplier)
      .mul(
        Big(10).pow(
          collateral.price.decimals + collateral.asset.config.extraDecimals
        )
      )
      .round(0, 0);
    const borrowedAmount = pricedAmount
      .div(borrowed.price.multiplier)
      .mul(
        Big(10).pow(
          borrowed.price.decimals + borrowed.asset.config.extraDecimals
        )
      )
      .round(0, 0);

    if (
      collateralAssets.length === 0 ||
      collateralAssets[collateralAssets.length - 1].tokenId !==
        collateral.tokenId
    ) {
      collateralAssets.push({
        tokenId: collateral.tokenId,
        amount: Big(0),
      });
    }
    const collateralAsset = collateralAssets[collateralAssets.length - 1];
    collateralAsset.amount = collateralAsset.amount.add(collateralAmount);

    if (
      borrowedAssets.length === 0 ||
      borrowedAssets[borrowedAssets.length - 1].tokenId !== borrowed.tokenId
    ) {
      borrowedAssets.push({
        tokenId: borrowed.tokenId,
        amount: Big(0),
      });
    }
    const borrowedAsset = borrowedAssets[borrowedAssets.length - 1];
    borrowedAsset.amount = borrowedAsset.amount.add(borrowedAmount);

    const adjustedCollateralAmount = collateralPricedAmount.mul(
      collateral.asset.config.volatilityRatio
    );
    const adjustedBorrowedAmount = pricedAmount.div(
      borrowed.asset.config.volatilityRatio
    );

    collateral.pricedBalance = collateral.pricedBalance.sub(
      collateralPricedAmount
    );
    collateral.adjustedPricedBalance = collateral.adjustedPricedBalance.sub(
      adjustedCollateralAmount
    );
    account.adjustedCollateralSum = account.adjustedCollateralSum.sub(
      adjustedCollateralAmount
    );

    borrowed.pricedBalance = borrowed.pricedBalance.sub(pricedAmount);
    borrowed.adjustedPricedBalance = borrowed.adjustedPricedBalance.sub(
      adjustedBorrowedAmount
    );
    account.adjustedBorrowedSum = account.adjustedBorrowedSum.sub(
      adjustedBorrowedAmount
    );

    recomputeAccountDiscount(account);
  }
  // console.log(
  //   `After liq: ${account.accountId} -> health ${account.healthFactor
  //     .mul(100)
  //     .toFixed(2)}% discount ${account.discount.mul(100).toFixed(2)}%`
  // );
  console.log(
    `Maybe liq ${account.accountId} -> discount ${origDiscount
      .mul(100)
      .toFixed(2)}% -> profit $${totalPricedProfit.toFixed(3)}`
  );

  // Adjusting collateralAssets amounts.
  collateralAssets.forEach((a) => {
    a.amount = a.amount.mul(9989).div(10000).round(0, 0);
  });
  borrowedAssets.forEach((a) => {
    a.amount = a.amount.mul(9990).div(10000).round(0, 0);
  });

  const liquidationAction = {
    account_id: account.accountId,
    in_assets: borrowedAssets.map((a) => ({
      token_id: a.tokenId,
      amount: a.amount.toFixed(0),
    })),
    out_assets: collateralAssets.map((a) => ({
      token_id: a.tokenId,
      amount: a.amount.toFixed(0),
    })),
  };
  const actions = {
    Execute: {
      actions: [
        ...liquidationAction.in_assets.map(({ amount, token_id }) => ({
          Borrow: {
            token_id,
            amount: Big(amount).add(1000).toFixed(0), // Add small fraction to avoid rounding errors with shares.
          },
        })),
        {
          Liquidate: liquidationAction,
        },
        ...liquidationAction.out_assets
          .slice(0, maxWithdrawCount)
          .map(({ amount, token_id }) => ({
            Withdraw: {
              token_id,
              max_amount: amount,
            },
          })),
      ],
    },
  };

  // console.log(liquidationAction);
  return {
    actions,
    totalPricedProfit,
    origDiscount,
    origHealth,
    health: account.healthFactor,
  };
};

module.exports = {
  parseAccount,
  processAccount,
  computeLiquidation,
};
