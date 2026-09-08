import { describe, expect, it } from "vitest";

import { resolveComputeSiteForClient } from "./compute-site-selection.js";

describe("machine compute selection", () => {
  it("keeps the selected remote model on the web instead of silently calling a hosted provider", () => {
    expect(
      resolveComputeSiteForClient({
        requestedSite: "machine",
        requestedModelId: "machine/desktop/ollama/gemma3:1b",
        requestedModel: {
          matchingModel: "gemma3:1b",
          provider: "ollama",
          runsOn: "device",
          machineId: "desktop",
        },
        hasDesktopBackend: false,
        hasBrowserRuntime: false,
      }),
    ).toEqual({ computeSite: "machine", modelId: "machine/desktop/ollama/gemma3:1b" });
  });
});
