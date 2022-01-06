module.exports = {
  API_SERVER_URL: "https://rest.nearapi.org",
  getConfig: (env) => {
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
          burrowContractId: "contract.beta.burrow.near",
          accountId: process.env.NEAR_ACCOUNT_ID,
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
        };
      default:
        throw Error(
          `Unconfigured environment '${env}'. Can be configured in src/config.js.`
        );
    }
  },
};
