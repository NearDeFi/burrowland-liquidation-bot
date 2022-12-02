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

const BrrrTokenId = "token.burrow.near";
const StNearTokenId = "meta-pool.near";

async function main() {
  const accounts = keysToCamel(JSON.parse(fs.readFileSync("accounts.json")));
  console.log("Num accounts", accounts.length);

  const parsedAccounts = accounts.slice(10).map((account) => {
    const raw = account.rawAccount;
    let claimedBalance = Big(0);
    raw.supplied.forEach((s) => {
      if (s.tokenId === BrrrTokenId) {
        claimedBalance = claimedBalance.add(Big(s.balance));
      }
    });

    let unclaimedBalance = Big(0);

    raw.farms.forEach((f) => {
      f.rewards.forEach((r) => {
        if (r.rewardTokenId === BrrrTokenId) {
          unclaimedBalance = unclaimedBalance.add(Big(r.unclaimedAmount));
        }
      });
    });

    // console.log(JSON.stringify(account, null, 2));
    return {
      accountId: account.accountId,
      brrrBalance: claimedBalance.add(unclaimedBalance).div(OneBrrr).toFixed(6),
      claimedBalance,
      unclaimedBalance,
      stakedBoosterAmount: raw.boosterStaking
        ? Big(raw.boosterStaking.stakedBoosterAmount).div(OneBrrr).toFixed(6)
        : 0.0,
      xBoosterAmount: raw.boosterStaking
        ? Big(raw.boosterStaking.xBoosterAmount).div(OneBrrr).toFixed(6)
        : 0.0,
      lockDurationDays: raw.boosterStaking
        ? (
            (parseFloat(raw.boosterStaking.unlockTimestamp) / 1e6 -
              currentTimestamp) /
            (24 * 60 * 60 * 1000)
          ).toFixed(6)
        : 0.0,
    };
  });

  console.log(JSON.stringify(parsedAccounts.slice(0, 10), null, 2));
  let data = [
    [
      "account_id",
      "brrr_balance",
      "raw_claimed",
      "raw_unclaimed",
      "staked_brrr",
      "xBrrr",
      "lock_duration_days",
    ],
    ...parsedAccounts.map(
      ({
        accountId,
        brrrBalance,
        claimedBalance,
        unclaimedBalance,
        stakedBoosterAmount,
        xBoosterAmount,
        lockDurationDays,
      }) => {
        return [
          accountId,
          brrrBalance,
          claimedBalance.toFixed(0),
          unclaimedBalance.toFixed(0),
          stakedBoosterAmount,
          xBoosterAmount,
          lockDurationDays,
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
