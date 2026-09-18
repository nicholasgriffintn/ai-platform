import { describe, expect, it } from "vitest";

import { extractImpactPayload } from "../index.js";

const IMPACT = {
  inferenceTime: { total: 1380, unit: "ms" },
  energy: { total: 526, unit: "Wms" },
  emissions: { total: 47, unit: "ugCO2e" },
  version: "20250922",
};

describe("extractImpactPayload", () => {
  it("reads the impact object from a provider response", () => {
    expect(extractImpactPayload({ choices: [], impact: IMPACT })).toEqual(IMPACT);
  });

  it("ignores payloads without a valid impact object", () => {
    expect(extractImpactPayload({ impact: { version: "20250922" } })).toBeNull();
    expect(extractImpactPayload({ impact: { energy: { total: -1, unit: "Wms" } } })).toBeNull();
    expect(extractImpactPayload({})).toBeNull();
    expect(extractImpactPayload(null)).toBeNull();
  });
});
