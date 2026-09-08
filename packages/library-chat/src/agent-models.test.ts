import { describe, expect, it } from "vitest";

import { discoverAgentModels } from "./agent-models.js";

describe("agent discovery", () => {
  it("keeps usable agents when another native probe fails", async () => {
    const models = await discoverAgentModels({
      async probeAgentTool(driver) {
        if (driver === "codex") {
          throw new Error("Native probe unavailable");
        }

        if (driver === "opencode") {
          return { state: "ready", checkedAt: "2026-09-08T10:00:00Z", version: "1.0.0" };
        }

        return { state: "missing", checkedAt: "2026-09-08T10:00:00Z" };
      },
    });

    expect(Object.keys(models)).toEqual(["agent/opencode"]);
    expect(models["agent/opencode"].isExecutable).toBe(true);
  });
});
