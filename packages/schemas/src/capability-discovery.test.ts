import { describe, expect, it } from "vitest";

import { capabilityDiscoveryResultSchema } from "./capability-discovery";

describe("capabilityDiscoveryResultSchema", () => {
  it("keeps stored results from before readiness timestamps readable", () => {
    expect(
      capabilityDiscoveryResultSchema.parse({
        query: "calendar",
        items: [],
        total: 0,
      }),
    ).toEqual({ query: "calendar", items: [], total: 0 });
  });
});
