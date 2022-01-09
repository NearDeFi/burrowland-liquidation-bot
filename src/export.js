#!/usr/bin/env node

const { initNear } = require("./near");
const {main} = require("./burrow");
const fs = require('fs');

const FILENAME = "burrow.json";

initNear(false)
    .then(main)
    .then(data => {
      fs.writeFile(FILENAME, data.accounts, function(err) {
        if (err) {
          console.log(err);
        }
        else{
            console.log(`File ${FILENAME} saved`);
        }
      });
    });
