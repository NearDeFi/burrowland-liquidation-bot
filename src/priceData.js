const { parseTimestamp } = require("./utils");
const Big = require("big.js");

const parsePrice = (p) => {
  return p
    ? {
        multiplier: Big(p.multiplier),
        decimals: p.decimals,
      }
    : null;
};

const parsePriceData = (r) => {
  return Object.assign(r, {
    timestamp: parseTimestamp(r.timestamp),
    prices: r.prices.reduce((prices, ap) => {
      prices[ap.assetId] = parsePrice(ap.price);
      return prices;
    }, {}),
  });
};

module.exports = {
  parsePriceData,
};
