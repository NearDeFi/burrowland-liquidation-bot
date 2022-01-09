const nearAPI = require("near-api-js");
const os = require("os");

const { getConfig } = require("./config");
const path = require("path");

const NearConfig = getConfig(process.env.NEAR_ENV || "development");

module.exports = {
  initNear: async (loadAccount) => {
    const keyStore = new nearAPI.keyStores.InMemoryKeyStore();

    let near;
    let account;

    if (loadAccount) {
      const keyPath = path.join(
          os.homedir(),
          ".near-credentials",
          NearConfig.networkId,
          NearConfig.accountId + ".json"
      );
      near = await nearAPI.connect(
          Object.assign({ keyPath, deps: { keyStore } }, NearConfig)
      );
      account = new nearAPI.Account(near.connection, NearConfig.accountId);
    }
    else {
      const nearRpc = new nearAPI.providers.JsonRpcProvider(NearConfig.nodeUrl);
      account = new nearAPI.Account({provider: nearRpc,
        networkId:  NearConfig.networkId, signer:  NearConfig.accountId},  NearConfig.accountId);
    }

    const tokenContract = (tokenAccountId) =>
      new nearAPI.Contract(account, tokenAccountId, {
        viewMethods: [
          "storage_balance_of",
          "ft_balance_of",
          "storage_balance_bounds",
          "ft_metadata",
        ],
        changeMethods: ["ft_transfer_call", "ft_transfer", "storage_deposit"],
      });

    const refFinanceContract = new nearAPI.Contract(
      account,
      NearConfig.refFinanceContractId,
      {
        viewMethods: [
          "get_deposits",
          "get_pools",
          "get_pool",
          "get_return",
          "get_number_of_pools",
          "get_deposit",
        ],
        changeMethods: ["storage_deposit", "swap", "withdraw"],
      }
    );

    const burrowContract = new nearAPI.Contract(
      account,
      NearConfig.burrowContractId,
      {
        viewMethods: [
          "get_account",
          "get_num_accounts",
          "get_accounts_paged",
          "get_asset",
          "get_assets",
          "get_assets_paged",
          "get_assets_paged_detailed",
          "get_config",
          "get_asset_farm",
          "get_asset_farms",
          "get_asset_farms_paged",
        ],
        changeMethods: ["storage_deposit", "execute"],
      }
    );

    const priceOracleContract = new nearAPI.Contract(
      account,
      NearConfig.priceOracleContractId,
      {
        viewMethods: ["get_price_data"],
        changeMethods: ["oracle_call"],
      }
    );

    return {
      near,
      account,
      tokenContract,
      refFinanceContract,
      burrowContract,
      priceOracleContract,
    };
  },
};
