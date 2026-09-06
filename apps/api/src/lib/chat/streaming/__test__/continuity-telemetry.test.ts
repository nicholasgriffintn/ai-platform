import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getInstance: vi.fn(),
  recordMetric: vi.fn(),
}));

vi.mock("~/lib/monitoring", () => ({
  Monitoring: { getInstance: mocks.getInstance },
}));

import { normaliseContinuityPlatform, recordTurnContinuityFinished } from "../continuity-telemetry";

describe("turn continuity telemetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getInstance.mockReturnValue({ recordMetric: mocks.recordMetric });
  });

  it("records only the continuity allowlist", () => {
    recordTurnContinuityFinished(
      { env: {}, traceId: "completion-1" },
      {
        platform: "mobile",
        outcome: "completed",
        startedAtMs: 1_000,
        finishedAtMs: 5_000,
        stream: {
          detached: true,
          detachedAtMs: 2_500,
          detachmentReason: "reader_closed",
        },
        cancellationObserved: false,
      },
    );

    expect(mocks.recordMetric).toHaveBeenCalledWith({
      traceId: "completion-1",
      timestamp: 5_000,
      type: "performance",
      name: "turn_continuity_finished",
      value: 4_000,
      metadata: {
        platform: "ios",
        connection_state: "detached",
        detachment_reason: "reader_closed",
        outcome: "completed",
        cancellation_observed: false,
        duration_before_detachment_ms: 1_500,
        duration_after_detachment_ms: 2_500,
      },
      status: "success",
    });
    expect(normaliseContinuityPlatform("untrusted-client-value")).toBe("unknown");
  });

  it("cannot affect a turn when monitoring fails", () => {
    mocks.getInstance.mockImplementation(() => {
      throw new Error("analytics unavailable");
    });

    expect(() =>
      recordTurnContinuityFinished(
        { env: {}, traceId: "completion-1" },
        {
          platform: "ios",
          outcome: "failed",
          startedAtMs: 1_000,
          finishedAtMs: 2_000,
          stream: { detached: true, detachedAtMs: 1_500, detachmentReason: "reader_closed" },
          cancellationObserved: false,
        },
      ),
    ).not.toThrow();
  });
});
