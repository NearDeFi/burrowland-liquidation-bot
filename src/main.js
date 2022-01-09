#!/usr/bin/env node

const { initNear } = require("./near");
const {main} = require("./burrow");


initNear(true)
    .then(main)
    .then(data => {
        console.log("Num accounts: ", data.numAccounts);
        console.log(data.accountsWithDebt)
    });
