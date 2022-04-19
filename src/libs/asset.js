const { parseRatio, parseRate, parseTimestamp } = require("./utils");
const Big = require("big.js");

const parsePool = (p) => {
  return {
    shares: Big(p.shares),
    balance: Big(p.balance),
  };
};

const parseConfig = (c) => {
  return Object.assign(c, {
    reserveRatio: parseRatio(c.reserveRatio),
    targetUtilization: parseRatio(c.targetUtilization),
    targetUtilizationRate: parseRate(c.targetUtilizationRate),
    maxUtilizationRate: parseRate(c.maxUtilizationRate),
    volatilityRatio: parseRatio(c.volatilityRatio),
  });
};

const parseAsset = (a) => {
  return {
    supplied: parsePool(a.supplied),
    borrowed: parsePool(a.borrowed),
    reserved: Big(a.reserved),
    lastUpdateTimestamp: parseTimestamp(a.lastUpdateTimestamp),
    config: parseConfig(a.config),
  };
};

module.exports = {
  parseAsset,
};
