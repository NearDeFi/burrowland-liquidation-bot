#!/bin/bash
set -e

export NEAR_ENV=mainnet

cd $(dirname "$0")

/usr/local/bin/node src/export.js 2>&1
