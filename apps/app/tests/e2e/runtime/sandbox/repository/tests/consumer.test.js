import assert from "node:assert/strict";

import { releaseStatus } from "../src/consumer.js";

assert.equal(releaseStatus, "draft");
