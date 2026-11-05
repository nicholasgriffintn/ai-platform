import { describe, expect, it } from "vitest";

import { describeModelDataRetention, getModelDataLocationLabel } from "./model-formatting.js";

const source = "https://example.com/privacy";

describe("getModelDataLocationLabel", () => {
  it("names documented regions and keeps the source", () => {
    expect(
      getModelDataLocationLabel({
        dataLocation: { kind: "regions", regions: ["us", "eu"], source },
      }),
    ).toMatchObject({ short: "US and EU", source });
  });

  it("says unknown when nothing is catalogued", () => {
    expect(getModelDataLocationLabel({}).short).toBe("Location unknown");
  });

  it("prefers where the model actually runs over the catalogue label", () => {
    const dataLocation = { kind: "unknown", source } as const;

    expect(getModelDataLocationLabel({ dataLocation, runsOn: "device" }).short).toBe(
      "On this device",
    );
    expect(getModelDataLocationLabel({ dataLocation, machineId: "m1" }).short).toBe("Your machine");
  });
});

describe("describeModelDataRetention", () => {
  it("does not imply a period the provider never stated", () => {
    expect(describeModelDataRetention({ maxDays: "unknown", source })).toBe(
      "The provider does not document how long it keeps prompts and replies.",
    );
  });
});
