const Big = require("big.js");

const parseAccountAsset = (a) => {
  return {
    tokenId: a.tokenId,
    shares: Big(a.shares),
  };
};

const parseAccount = (a) => {
  return {
    accountId: a.accountId,
    collateral: a.collateral.map(parseAccountAsset),
    borrowed: a.borrowed.map(parseAccountAsset),
  };
};

const processAccountAsset = (a, assets, prices, supplied) => {
  const asset = assets[a.tokenId];
  const pool = supplied ? asset.supplied : asset.borrowed;
  const price = prices.prices[a.tokenId];
  a.balance = pool.balance
    .mul(a.shares)
    .div(pool.shares)
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

const processAccount = (account, assets, prices) => {
  account.collateral.forEach(
    (a) => (a = processAccountAsset(a, assets, prices, true))
  );
  account.adjustedCollateralSum = assetAdjustedPricedSum(account.collateral);
  account.borrowed.forEach((a) =>
    processAccountAsset(a, assets, prices, false)
  );
  account.adjustedBorrowedSum = assetAdjustedPricedSum(account.borrowed);
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

  return account;
};

module.exports = {
  parseAccount,
  processAccount,
};
