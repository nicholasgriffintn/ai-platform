import { describe, expect, it } from "vitest";

import {
  decodeReadiness,
  READINESS_ACTION_KINDS,
  READINESS_REASON_CODES,
  readinessSchema,
} from "./readiness.js";

const timestamps = {
  checkedAt: "2026-09-05T10:00:00.000Z",
  expiresAt: "2026-09-05T10:01:00.000Z",
};

describe("readiness schema", () => {
  it("publishes runtime reason codes and actions without changing the protocol version", () => {
    for (const reasonCode of READINESS_REASON_CODES) {
      expect(
        readinessSchema.parse({
          protocolVersion: 1,
          state: reasonCode === "ready" ? "ready" : "unavailable",
          reasonCode,
          reason: "Readiness detail",
          ...timestamps,
        }),
      ).toMatchObject({ protocolVersion: 1, reasonCode });
    }

    for (const kind of READINESS_ACTION_KINDS) {
      expect(
        readinessSchema.parse({
          protocolVersion: 1,
          state: "unavailable",
          reasonCode: "runtime_unreachable",
          reason: "The runtime is not responding.",
          ...timestamps,
          action: { kind, label: "Take action" },
        }).action?.kind,
      ).toBe(kind);
    }
  });

  it("keeps unknown reason codes visible while removing unsafe actions", () => {
    const decoded = decodeReadiness({
      protocolVersion: 1,
      state: "unknown",
      reasonCode: "future_runtime_state",
      reason: "A newer client reported a runtime state.",
      ...timestamps,
      action: { kind: "future_action", label: "Do something", path: "/future" },
    });

    expect(decoded).toMatchObject({
      protocolVersion: 1,
      state: "unknown",
      reasonCode: "check_failed",
      reason: "A newer client reported a runtime state.",
    });
    expect(decoded?.action).toBeUndefined();

    const unknownAction = decodeReadiness({
      protocolVersion: 1,
      state: "unavailable",
      reasonCode: "runtime_unreachable",
      reason: "The runtime is not responding.",
      ...timestamps,
      action: { kind: "future_action", label: "Do something", path: "/future" },
    });

    expect(unknownAction).toMatchObject({ reasonCode: "runtime_unreachable" });
    expect(unknownAction?.action).toBeUndefined();
  });

  it("keeps known runtime actions actionable", () => {
    const decoded = decodeReadiness({
      protocolVersion: 1,
      state: "setup_required",
      reasonCode: "runtime_not_configured",
      reason: "Set up the runtime.",
      ...timestamps,
      action: { kind: "open_runtimes", label: "Set up", path: "/downloads" },
    });

    expect(decoded?.action).toEqual({ kind: "open_runtimes", label: "Set up", path: "/downloads" });
  });
});
