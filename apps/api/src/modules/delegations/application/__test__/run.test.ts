import { describe, expect, it } from "vitest";

import { resolveExecutionRoute } from "~/modules/models/domain/execution-route";

describe("delegation execution routing", () => {
  it("routes the hosted provider to the task queue", () => {
    expect(resolveExecutionRoute({ provider: "workers-ai", runsOn: "server" })).toBe("hosted");
  });

  it("routes the sandbox provider to sandbox dispatch", () => {
    expect(resolveExecutionRoute({ provider: "polychat-sandbox", runsOn: "server" })).toBe(
      "sandbox",
    );
  });

  it("keeps device providers out of the Worker queue", () => {
    expect(resolveExecutionRoute({ provider: "claude-code", runsOn: "device" })).toBe("machine");
  });
});
