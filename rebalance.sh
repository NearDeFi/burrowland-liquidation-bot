#!/bin/bash

mkdir -p logs

export NEAR_ENV=mainnet
export NEAR_ACCOUNT_ID=$YOUR_ACCOUNT_ID
export MIN_SWAP_AMOUNT=1
export MIN_REPAY_AMOUNT=1
export MAX_SLIPPAGE=0.5

cd $(dirname "$0")
DATE=$(date "+%Y_%m_%d")
while :
do
  date | tee -a logs/rebalance_logs_$DATE.txt
  /usr/local/bin/node ./src/rebalance.js 2>&1 | tee -a logs/rebalance_logs_$DATE.txt
  sleep 5
done
