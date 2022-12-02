#!/bin/bash

export NEAR_ENV=mainnet

cd $(dirname "$0")
/usr/local/bin/node ./src/fetch_accounts.js
/usr/local/bin/node ./src/account_parser.js
