#!/usr/bin/env node

const { initNear } = require("./near");
const { main } = require("./burrow");

initNear(true).then((nearObject) => main(nearObject, true));
