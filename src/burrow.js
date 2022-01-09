const Big = require("big.js");
const {keysToCamel} = require("./utils");
const {parseAsset} = require("./asset");
const {parsePriceData} = require("./priceData");
const {parseAccount, processAccount} = require("./account");

Big.DP = 27;

module.exports = {
    main: async (nearObjects) => {
        const {
            near,
            account,
            tokenContract,
            refFinanceContract,
            burrowContract,
            priceOracleContract,
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

        const accounts = keysToCamel(
            await burrowContract.get_accounts_paged({limit: 100})
        )
            .map((a) => processAccount(parseAccount(a), assets, prices))
            .filter((a) => !!a.healthFactor);

        accounts.sort((a, b) => {
            return a.healthFactor.cmp(b.healthFactor);
        });

        const accountsWithDebt = accounts.filter((a) => a.discount.gt(0));

        accountsWithDebt.sort((a, b) => {
            return a.discount.cmp(b.discount);
        });

        return {
            numAccounts,
            accounts: JSON.stringify(accounts, undefined, 2),
            accountsWithDebt: JSON.stringify(accountsWithDebt, undefined, 2)
        };
    }
}
