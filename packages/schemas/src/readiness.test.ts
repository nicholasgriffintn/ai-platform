import { describe, expect, it } from "vitest";

import { isReadinessFresh, readinessSchema } from "./readiness";

describe("readiness", () => {
  const readiness = {
    protocolVersion: 1 as const,
    state: "unknown" as const,
    reasonCode: "check_failed" as const,
    reason: "Readiness could not be checked.",
    checkedAt: "2026-09-05T10:00:00.000Z",
    expiresAt: "2026-09-05T10:01:00.000Z",
    action: { kind: "retry" as const, label: "Retry" },
  };

  it("distinguishes an unknown fresh result from a known failure", () => {
    expect(readinessSchema.parse(readiness).state).toBe("unknown");
    expect(isReadinessFresh(readiness, new Date("2026-09-05T10:00:59.000Z"))).toBe(true);
    expect(isReadinessFresh(readiness, new Date("2026-09-05T10:01:00.000Z"))).toBe(false);
  });

  it("rejects an expiry before the check time", () => {
    expect(() =>
      readinessSchema.parse({
        ...readiness,
        expiresAt: "2026-09-05T09:59:00.000Z",
      }),
    ).toThrow(/expiry/i);
  });
});
