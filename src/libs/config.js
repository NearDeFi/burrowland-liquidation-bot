const Big = require("big.js");
module.exports = {
  getConfig: (env) => {
    const config = (() => {
      switch (env) {
        case "production":
        case "mainnet":
          return {
            networkId: "mainnet",
            nodeUrl: process.env.NODE_URL || "https://rpc.mainnet.near.org",
            walletUrl: "https://wallet.near.org",
            helperUrl: "https://helper.mainnet.near.org",
            explorerUrl: "https://explorer.mainnet.near.org",
            refFinanceContractId: "v2.ref-finance.near",
            priceOracleContractId: "priceoracle.near",
            burrowContractId: "contract.main.burrow.near",
            accountId: process.env.NEAR_ACCOUNT_ID,
            wrapNearAccountId: "wrap.near",
          };
        case "development":
        case "testnet":
          return {
            networkId: "testnet",
            nodeUrl: process.env.NODE_URL || "https://rpc.testnet.near.org",
            walletUrl: "https://wallet.testnet.near.org",
            helperUrl: "https://helper.testnet.near.org",
            explorerUrl: "https://explorer.testnet.near.org",
            refFinanceContractId: "ref-finance-101.testnet",
            priceOracleContractId: "priceoracle.testnet",
            burrowContractId: "contract.1638481328.burrow.testnet",
            accountId: process.env.NEAR_ACCOUNT_ID,
            wrapNearAccountId: "wrap.testnet",
          };
        default:
          throw Error(
            `Unconfigured environment '${env}'. Can be configured in src/config.js.`
          );
      }
    })();
    config.minProfit = Big(process.env.MIN_PROFIT || "1.0");
    config.minDiscount = Big(process.env.MIN_DISCOUNT || "0.025");
    config.showWhales = !!process.env.SHOW_WHALES;
    config.minSwapAmount = Big(process.env.MIN_SWAP_AMOUNT || "0.1");
    config.minRepayAmount = Big(process.env.MIN_REPAY_AMOUNT || "0.5");
    config.maxSlippage = Big(process.env.MAX_SLIPPAGE || "0.25");
    config.maxLiquidationAmount = Big(
      process.env.MAX_LIQUIDATION_AMOUNT || "20000"
    );
    return config;
  },
};
