import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getInstance: vi.fn(),
  recordMetric: vi.fn(),
}));

vi.mock("~/lib/monitoring", () => ({
  Monitoring: { getInstance: mocks.getInstance },
}));

import { normaliseContinuityPlatform, recordTurnContinuityFinished } from "../continuity-telemetry";
import { createChatSseStreamWriter } from "../emitter";

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

  it.each(["reader_closed", "write_failed"] as const)(
    "records %s without leaking streamed content",
    async (reason) => {
      const writer = createChatSseStreamWriter();
      const reader = writer.readable.getReader();

      if (reason === "reader_closed") {
        await reader.cancel();
      } else {
        const enqueue = vi
          .spyOn(ReadableStreamDefaultController.prototype, "enqueue")
          .mockImplementationOnce(() => {
            throw new Error("private provider failure");
          });

        try {
          await writer.writeComment("private response content");
        } finally {
          enqueue.mockRestore();
          await reader.cancel();
        }
      }

      recordTurnContinuityFinished(
        { env: {}, traceId: "run" },
        {
          platform: "web",
          outcome: "completed",
          startedAtMs: Date.now() - 100,
          finishedAtMs: Date.now(),
          stream: writer.getContinuitySnapshot(),
          cancellationObserved: false,
        },
      );
      expect(mocks.recordMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            connection_state: "detached",
            detachment_reason: reason,
          }),
        }),
      );
      expect(JSON.stringify(mocks.recordMetric.mock.calls)).not.toContain("private");
    },
  );
});
