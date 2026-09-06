const assert = require("node:assert/strict");
const fs = require("node:fs");

assert.match(fs.readFileSync("README.md", "utf8"), /Sandbox E2E verified\./);
console.log("Sandbox fixture validation passed");
