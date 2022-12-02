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

const currentTimestamp = new Date().getTime();
const OneBrrr = Big(10).pow(18);

const StNearTokenId = "meta-pool.near";
const LinearTokenId = "linear-protocol.near";
const UsdtTokenId =
  "dac17f958d2ee523a2206206994597c13d831ec7.factory.bridge.near";

async function main() {
  const accounts = keysToCamel(JSON.parse(fs.readFileSync("accounts.json")));
  console.log("Num accounts", accounts.length);

  const parsedAccounts = accounts.slice(10).map((account) => {
    // console.log(account);
    // throw "bgfbs";
    // const raw = account.rawAccount;
    let nonCollateralUsdtBalance = Big(0);
    let nonCollateralOtherBalance = Big(0);
    let collateralUsdtBalance = Big(0);
    let collateralOtherBalance = Big(0);
    let borrowedUsdtBalance = Big(0);
    let borrowedOtherBalance = Big(0);
    account.supplied.forEach((s) => {
      if (s.tokenId === UsdtTokenId) {
        nonCollateralUsdtBalance = nonCollateralUsdtBalance.add(
          Big(s.pricedBalance || 0)
        );
      } else {
        nonCollateralOtherBalance = nonCollateralOtherBalance.add(
          Big(s.pricedBalance || 0)
        );
      }
    });
    account.collateral.forEach((s) => {
      if (s.tokenId === UsdtTokenId) {
        collateralUsdtBalance = collateralUsdtBalance.add(
          Big(s.pricedBalance || 0)
        );
      } else {
        collateralOtherBalance = collateralOtherBalance.add(
          Big(s.pricedBalance || 0)
        );
      }
    });
    account.borrowed.forEach((s) => {
      if (s.tokenId === UsdtTokenId) {
        borrowedUsdtBalance = borrowedUsdtBalance.add(
          Big(s.pricedBalance || 0)
        );
      } else {
        borrowedOtherBalance = borrowedOtherBalance.add(
          Big(s.pricedBalance || 0)
        );
      }
    });

    return {
      accountId: account.accountId,
      nonCollateralUsdtBalance: nonCollateralUsdtBalance.toFixed(2),
      collateralUsdtBalance: collateralUsdtBalance.toFixed(2),
      borrowedUsdtBalance: borrowedUsdtBalance.toFixed(2),
      nonCollateralOtherBalance: nonCollateralOtherBalance.toFixed(2),
      collateralOtherBalance: collateralOtherBalance.toFixed(2),
      borrowedOtherBalance: borrowedOtherBalance.toFixed(2),
      borrowedBalance: Big(account.borrowedSum).toFixed(2),
    };
  });

  // console.log(JSON.stringify(parsedAccounts.slice(0, 10), null, 2));
  let data = [
    [
      "accountId",
      "nonCollateralUsdtBalance",
      "collateralUsdtBalance",
      "borrowedUsdtBalance",
      "nonCollateralOtherBalance",
      "collateralOtherBalance",
      "borrowedOtherBalance",
      "borrowedBalance",
    ],
    ...parsedAccounts.map(
      ({
        accountId,
        nonCollateralUsdtBalance,
        collateralUsdtBalance,
        borrowedUsdtBalance,
        nonCollateralOtherBalance,
        collateralOtherBalance,
        borrowedOtherBalance,
        borrowedBalance,
      }) => {
        return [
          accountId,
          nonCollateralUsdtBalance,
          collateralUsdtBalance,
          borrowedUsdtBalance,
          nonCollateralOtherBalance,
          collateralOtherBalance,
          borrowedOtherBalance,
          borrowedBalance,
        ];
      }
    ),
  ]
    .map((arr) => arr.join(","))
    .join("\n");
  fs.writeFile("accounts.csv", data, function (err) {
    if (err) {
      console.log(err);
    } else {
      console.log(`File "accounts.csv" saved`);
    }
  });
}

main();
