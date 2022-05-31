#!/usr/bin/env node

const { initNear } = require("./libs/near");
const { main } = require("./libs/burrow");
const fs = require("fs");

const FILENAME = "burrow.json";

initNear(false)
  .then((nearObject) => main(nearObject))
  .then((data) => {
    fs.writeFile(FILENAME, data.accounts, function (err) {
      if (err) {
        console.log(err);
      } else {
        console.log(`File ${FILENAME} saved`);
      }
    });
  });
