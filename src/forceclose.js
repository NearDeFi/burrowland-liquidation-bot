#!/usr/bin/env node

const { initNear } = require("./libs/near");
const { main: liquidate } = require("./libs/burrow");

initNear(true).then((nearObject) =>
  liquidate(nearObject, { forceClose: true })
);
