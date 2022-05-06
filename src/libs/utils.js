const Big = require("big.js");
const fs = require("fs");

const toCamel = (s) => {
  return s.replace(/([-_][a-z])/gi, ($1) => {
    return $1.toUpperCase().replace("-", "").replace("_", "");
  });
};

const isArray = (a) => Array.isArray(a);

const isObject = (o) =>
  o === Object(o) && !isArray(o) && typeof o !== "function";

const keysToCamel = (o) => {
  if (isObject(o)) {
    const n = {};

    Object.keys(o).forEach((k) => {
      n[toCamel(k)] = keysToCamel(o[k]);
    });

    return n;
  } else if (isArray(o)) {
    return o.map((i) => {
      return keysToCamel(i);
    });
  }

  return o;
};

const parseRate = (s) => Big(s).div(Big(10).pow(27));
const parseRatio = (r) => Big(r).div(10000);
const parseTimestamp = (s) => parseFloat(s) / 1e6;

const bigMin = (a, b) => (a.lt(b) ? a : b);

function loadJson(filename, ignoreError = true) {
  try {
    let rawData = fs.readFileSync(filename);
    return JSON.parse(rawData);
  } catch (e) {
    if (!ignoreError) {
      console.error("Failed to load JSON:", filename, e);
    }
  }
  return null;
}

function saveJson(json, filename) {
  try {
    const data = JSON.stringify(json);
    fs.writeFileSync(filename, data);
  } catch (e) {
    console.error("Failed to save JSON:", filename, e);
  }
}

module.exports = {
  bigMin,
  keysToCamel,
  parseRate,
  parseRatio,
  parseTimestamp,
  loadJson,
  saveJson,
};
