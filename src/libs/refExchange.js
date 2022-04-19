//! The code below is based on skyward finance https://github.com/skyward-finance/app-ui.

const Big = require("big.js");

const usdTokensDecimals = {
  "6b175474e89094c44da98b954eedeac495271d0f.factory.bridge.near": 18,
  "a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.factory.bridge.near": 6,
  "dac17f958d2ee523a2206206994597c13d831ec7.factory.bridge.near": 6,
  usn: 18,
};

const usdTokens = Object.entries(usdTokensDecimals).reduce(
  (acc, [key, value]) => {
    acc[key] = Big(10).pow(value);
    return acc;
  },
  {}
);

function stablePoolGetReturn(pool, tokenIn, amountIn, tokenOut) {
  let tokenInIndex = pool.tt.indexOf(tokenIn);
  let tokenOutIndex = pool.tt.indexOf(tokenOut);
  // Sub 1
  const cAmountIn = amountIn
    .sub(1)
    .mul(Big(10).pow(18 - usdTokensDecimals[tokenIn]));

  let y = stablePoolComputeY(
    pool,
    cAmountIn.add(pool.cAmounts[tokenInIndex]),
    tokenInIndex,
    tokenOutIndex
  );

  let dy = pool.cAmounts[tokenOutIndex].sub(y);
  let tradeFee = dy.mul(pool.fee).div(10000).round(0, 0);
  let amountSwapped = dy.sub(tradeFee);

  return amountSwapped
    .div(Big(10).pow(18 - usdTokensDecimals[tokenOut]))
    .round(0, 0);
}

function stablePoolGetInverseReturn(pool, tokenOut, amountOut, tokenIn) {
  let tokenInIndex = pool.tt.indexOf(tokenIn);
  let tokenOutIndex = pool.tt.indexOf(tokenOut);

  const amountOutWithFee = amountOut
    .mul(10000)
    .div(10000 - pool.fee)
    .round(0, 0);
  const cAmountOut = amountOutWithFee.mul(
    Big(10).pow(18 - usdTokensDecimals[tokenOut])
  );

  let y = stablePoolComputeY(
    pool,
    pool.cAmounts[tokenOutIndex].sub(cAmountOut),
    tokenOutIndex,
    tokenInIndex
  );

  let cAmountIn = y.sub(pool.cAmounts[tokenInIndex]);

  // Adding 1 for internal pool rounding
  return cAmountIn
    .div(Big(10).pow(18 - usdTokensDecimals[tokenIn]))
    .add(1)
    .round(0, 0);
}

export function getRefReturn(pool, tokenIn, amountIn, tokenOut) {
  if (!amountIn || amountIn.eq(0)) {
    return Big(0);
  }
  if (
    !(tokenIn in pool.tokens) ||
    !(tokenOut in pool.tokens) ||
    tokenIn === tokenOut
  ) {
    return null;
  }
  if (pool.stable) {
    return stablePoolGetReturn(pool, tokenIn, amountIn, tokenOut);
  }
  const balanceIn = pool.tokens[tokenIn];
  const balanceOut = pool.tokens[tokenOut];
  let amountWithFee = Big(amountIn).mul(Big(10000 - pool.fee));
  return amountWithFee
    .mul(balanceOut)
    .div(Big(10000).mul(balanceIn).add(amountWithFee))
    .round(0, 0);
}

export function getRefInverseReturn(pool, tokenOut, amountOut, tokenIn) {
  if (!amountOut || amountOut.eq(0)) {
    return Big(0);
  }
  if (
    !(tokenIn in pool.tokens) ||
    !(tokenOut in pool.tokens) ||
    tokenIn === tokenOut
  ) {
    return null;
  }
  if (pool.stable) {
    return stablePoolGetInverseReturn(pool, tokenOut, amountOut, tokenIn);
  }
  const balanceIn = pool.tokens[tokenIn];
  const balanceOut = pool.tokens[tokenOut];
  if (amountOut.gte(balanceOut)) {
    return null;
  }
  return Big(10000)
    .mul(balanceIn)
    .mul(amountOut)
    .div(Big(10000 - pool.fee).mul(balanceOut.sub(amountOut)))
    .round(0, 3);
}

function stablePoolComputeD(pool) {
  let sumX = pool.cAmounts.reduce((sum, v) => sum.add(v), Big(0));
  if (sumX.eq(0)) {
    return Big(0);
  } else {
    let d = sumX;
    let dPrev;

    for (let i = 0; i < 256; ++i) {
      let dProd = d;
      for (let j = 0; j < pool.nCoins; ++j) {
        dProd = dProd.mul(d).div(pool.cAmounts[j].mul(pool.nCoins)).round(0, 0);
      }
      dPrev = d;

      let leverage = sumX.mul(pool.ann);
      let numerator = dPrev.mul(dProd.mul(pool.nCoins).add(leverage));
      let denominator = dPrev
        .mul(pool.ann.sub(1))
        .add(dProd.mul(pool.nCoins + 1));
      d = numerator.div(denominator).round(0, 0);

      // Equality with the precision of 1
      if (d.gt(dPrev)) {
        if (d.sub(dPrev).lte(1)) {
          break;
        }
      } else if (dPrev.sub(d).lte(1)) {
        break;
      }
    }
    return d;
  }
}

function stablePoolComputeY(pool, xCAmount, indexX, indexY) {
  // invariant
  let d = pool.d;
  let s = xCAmount;
  let c = d.mul(d).div(xCAmount).round(0, 0);
  pool.cAmounts.forEach((c_amount, idx) => {
    if (idx !== indexX && idx !== indexY) {
      s = s.add(c_amount);
      c = c.mul(d).div(c_amount).round(0, 0);
    }
  });
  c = c.mul(d).div(pool.ann.mul(pool.nn)).round(0, 0);
  let b = d.div(pool.ann).round(0, 0).add(s); // d will be subtracted later

  // Solve for y by approximating: y**2 + b*y = c
  let yPrev;
  let y = d;
  for (let i = 0; i < 256; ++i) {
    yPrev = y;
    // $ y_{k+1} = \frac{y_k^2 + c}{2y_k + b - D} $
    let yNumerator = y.pow(2).add(c);
    let yDenominator = y.mul(2).add(b).sub(d);
    y = yNumerator.div(yDenominator).round(0, 0);
    if (y.gt(yPrev)) {
      if (y.sub(yPrev).lte(1)) {
        break;
      }
    } else if (yPrev.sub(y).lte(1)) {
      break;
    }
  }
  return y;
}

async function prepareRef(nearObjects) {
  const { near, refFinanceContract, NearConfig } = nearObjects;

  const limit = 250;
  // Limit pools for now until we need other prices.
  const numPools = Math.min(
    10000,
    await refFinanceContract.get_number_of_pools()
  );
  const promises = [];
  for (let i = 0; i < numPools; i += limit) {
    promises.push(refFinanceContract.get_pools({ from_index: i, limit }));
  }
  const rawPools = (await Promise.all(promises)).flat();

  const poolsByToken = {};
  const poolsByPair = {};

  const addPools = (token, pool) => {
    let ps = poolsByToken[token] || [];
    ps.push(pool);
    poolsByToken[token] = ps;

    pool.ots[token].forEach((ot) => {
      const pair = `${token}:${ot}`;
      ps = poolsByPair[pair] || [];
      ps.push(pool);
      poolsByPair[pair] = ps;
    });
  };

  const pools = {};
  rawPools.forEach((pool, i) => {
    if (pool.pool_kind === SimplePool || pool.pool_kind === StablePool) {
      const tt = pool.token_account_ids;
      const p = {
        stable: pool.pool_kind === StablePool,
        index: i,
        tt,
        tokens: tt.reduce((acc, token, tokenIndex) => {
          acc[token] = Big(pool.amounts[tokenIndex]);
          return acc;
        }, {}),
        ots: tt.reduce((acc, token) => {
          acc[token] = tt.filter((t) => t !== token);
          return acc;
        }, {}),
        fee: pool.total_fee,
        shares: Big(pool.shares_total_supply),
        amp: pool.amp || 0,
      };
      if (p.stable) {
        p.cAmounts = [...pool.amounts].map((amount, idx) => {
          let factor = Big(10).pow(18 - usdTokensDecimals[tt[idx]]);
          return Big(amount).mul(factor);
        });
        p.nCoins = p.cAmounts.length;
        p.nn = Big(Math.pow(p.nCoins, p.nCoins));
        p.ann = Big(p.amp).mul(p.nn);
        p.d = stablePoolComputeD(p);
      }

      if (p.shares.gt(0)) {
        pools[p.index] = p;
        p.tt.forEach((t) => addPools(t, p));
      }
    }
  });

  return {
    pools,
    poolsByToken,
    poolsByPair,
  };
}

const findBestReturn = (
  refFinance,
  inTokenAccountId,
  outTokenAccountId,
  amountIn
) => {
  let swapInfo = {
    amountIn,
    amountOut: Big(0),
  };
  // Computing path
  Object.values(refFinance.poolsByToken[inTokenAccountId] || {}).forEach(
    (pool) => {
      // 1 token
      if (outTokenAccountId in pool.tokens) {
        const poolReturn =
          getRefReturn(pool, inTokenAccountId, amountIn, outTokenAccountId) ||
          Big(0);

        if (poolReturn.gt(swapInfo.amountOut)) {
          swapInfo = {
            amountIn,
            amountOut: poolReturn,
            pools: [pool],
            swapPath: [inTokenAccountId, outTokenAccountId],
          };
        }
      } else {
        // 2 tokens
        pool.ots[inTokenAccountId].forEach((middleTokenAccountId) => {
          const pair = `${middleTokenAccountId}:${outTokenAccountId}`;
          let poolReturn = false;
          Object.values(refFinance.poolsByPair[pair] || {}).forEach((pool2) => {
            poolReturn =
              poolReturn === false
                ? getRefReturn(
                    pool,
                    inTokenAccountId,
                    amountIn,
                    middleTokenAccountId
                  )
                : poolReturn;
            if (!poolReturn) {
              return;
            }
            const pool2Return =
              getRefReturn(
                pool2,
                middleTokenAccountId,
                poolReturn,
                outTokenAccountId
              ) || Big(0);
            if (pool2Return.gt(swapInfo.amountOut)) {
              swapInfo = {
                amountIn,
                amountOut: pool2Return,
                pools: [pool, pool2],
                swapPath: [
                  inTokenAccountId,
                  middleTokenAccountId,
                  outTokenAccountId,
                ],
              };
            }
          });
        });
      }
    }
  );
  return Object.assign(swapInfo, {
    inTokenAccountId,
    outTokenAccountId,
    expectedAmountOut: Big(0),
  });
};

const findBestInverseReturn = (
  refFinance,
  inTokenAccountId,
  outTokenAccountId,
  availableInToken,
  outAmount
) => {
  let swapInfo = {
    amountIn: availableInToken,
    amountOut: Big(0),
  };
  // Computing path
  Object.values(refFinance.poolsByToken[outTokenAccountId] || {}).forEach(
    (pool) => {
      // 1 token
      if (inTokenAccountId in pool.tokens) {
        const amountIn = getRefInverseReturn(
          pool,
          outTokenAccountId,
          outAmount,
          inTokenAccountId
        );
        if (!amountIn) {
          return;
        }

        if (amountIn.lt(swapInfo.amountIn)) {
          swapInfo = {
            amountIn,
            amountOut: outAmount,
            pools: [pool],
            swapPath: [inTokenAccountId, outTokenAccountId],
          };
        }
      } else {
        // 2 tokens
        pool.ots[outTokenAccountId].forEach((middleTokenAccountId) => {
          const pair = `${middleTokenAccountId}:${inTokenAccountId}`;
          let middleAmountIn = false;
          Object.values(refFinance.poolsByPair[pair] || {}).forEach((pool2) => {
            middleAmountIn =
              middleAmountIn === false
                ? getRefInverseReturn(
                    pool,
                    outTokenAccountId,
                    outAmount,
                    middleTokenAccountId
                  )
                : middleAmountIn;
            if (!middleAmountIn) {
              return;
            }
            const amountIn = getRefInverseReturn(
              pool2,
              middleTokenAccountId,
              middleAmountIn,
              inTokenAccountId
            );
            if (!amountIn) {
              return;
            }
            if (amountIn.lt(swapInfo.amountIn)) {
              swapInfo = {
                amountIn,
                amountOut: outAmount,
                pools: [pool2, pool],
                swapPath: [
                  inTokenAccountId,
                  middleTokenAccountId,
                  outTokenAccountId,
                ],
              };
            }
          });
        });
      }
    }
  );

  return Object.assign(swapInfo, {
    inTokenAccountId,
    outTokenAccountId,
    expectedAmountOut: outAmount,
  });
};

async function executeSwap(nearObjects, swapInfo) {
  const { tokenContract, NearConfig } = nearObjects;
  let tokenId = swapInfo.inTokenAccountId;
  let token = tokenContract(tokenId);
  return Big(
    await token.ft_transfer_call(
      {
        receiver_id: NearConfig.refFinanceContractId,
        amount: swapInfo.amountIn.toFixed(0),
        msg: JSON.stringify({
          actions: swapInfo.pools.map((pool, idx) => {
            const tokenIn = tokenId;
            tokenId = swapInfo.swapPath[idx + 1];
            return {
              pool_id: pool.index,
              token_in: tokenIn,
              token_out: tokenId,
              min_amount_out:
                tokenId === swapInfo.outTokenAccountId
                  ? swapInfo.amountOut
                      .mul(1.0 - NearConfig.maxSlippage)
                      .round(0, 0)
                      .toFixed(0)
                  : "0",
            };
          }),
        }),
      },
      Big(10).pow(12).mul(300).toFixed(0),
      "1"
    )
  );
}

async function refSell(nearObjects, tokenId, amountIn) {
  const { NearConfig } = nearObjects;

  if (tokenId === NearConfig.wrapNearAccountId) {
    return amountIn;
  }

  const refFinance = await prepareRef(nearObjects);
  const swapInfo = findBestReturn(
    refFinance,
    tokenId,
    NearConfig.wrapNearAccountId,
    amountIn
  );

  return executeSwap(nearObjects, swapInfo);
}

async function refBuy(nearObjects, tokenId, amountOut) {
  const { NearConfig } = nearObjects;

  if (tokenId === NearConfig.wrapNearAccountId) {
    return amountOut;
  }

  const refFinance = await prepareRef(nearObjects);
  const swapInfo = findBestInverseReturn(
    refFinance,
    NearConfig.wrapNearAccountId,
    tokenId,
    Big(10).pow(32),
    amountOut
  );

  return executeSwap(nearObjects, swapInfo);
}

module.exports = {
  refSell,
  refBuy,
};
