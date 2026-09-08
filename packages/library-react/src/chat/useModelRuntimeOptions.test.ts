import { describe, expect, it } from "vitest";

import { buildModelRuntimeOptions } from "./useModelRuntimeOptions";

describe("model runtime availability", () => {
  it("does not invent devices or machines without configured endpoints", () => {
    expect(buildModelRuntimeOptions({}).map((option) => option.site)).toEqual([
      "hosted",
      "browser",
    ]);
    expect(buildModelRuntimeOptions({}, []).map((option) => option.site)).toEqual([
      "hosted",
      "browser",
    ]);
  });

  it("includes real advertised machines in the web selector", () => {
    const options = buildModelRuntimeOptions(
      {
        local: {
          matchingModel: "local",
          provider: "ollama",
          runsOn: "device",
          machineId: "machine-1",
        },
      },
      [],
      [{ machineId: "machine-1", label: "Office PC" }],
    );

    expect(options.find((option) => option.machineId === "machine-1")?.label).toBe("Office PC");
  });
});
