import { describe, expect, it } from "vitest";

import { resolveDelegationExecutionRoute } from "../routing";

describe("delegation execution routing", () => {
  it("routes the hosted provider to the task queue", () => {
    expect(resolveDelegationExecutionRoute({ provider: "workers-ai", runsOn: "server" })).toBe(
      "hosted",
    );
  });

  it("routes the sandbox provider to sandbox dispatch", () => {
    expect(
      resolveDelegationExecutionRoute({ provider: "polychat-sandbox", runsOn: "server" }),
    ).toBe("sandbox");
  });

  it("keeps device providers out of the Worker queue", () => {
    expect(resolveDelegationExecutionRoute({ provider: "claude-code", runsOn: "device" })).toBe(
      "machine",
    );
  });
});
