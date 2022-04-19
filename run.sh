#!/bin/bash

mkdir -p logs

export NEAR_ENV=mainnet
export NEAR_ACCOUNT_ID=$YOUR_ACCOUNT_ID
export MIN_PROFIT=0.25
export MIN_DISCOUNT=0.01

cd $(dirname "$0")
DATE=$(date "+%Y_%m_%d")
while :
do
  date | tee -a logs/logs_$DATE.txt
  /usr/local/bin/node ./src/liquidate.js 2>&1 | tee -a logs/logs_$DATE.txt
  sleep 5
done
