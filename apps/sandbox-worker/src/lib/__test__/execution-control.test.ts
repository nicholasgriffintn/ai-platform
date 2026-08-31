import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SandboxCancellationError } from "../cancellation";
import { createExecutionControl, SandboxTimeoutError } from "../execution-control";

function toJsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

describe("execution control", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("throws a timeout error once deadline is exceeded", async () => {
    vi.useFakeTimers();
    const serviceFetchMock = vi.fn();
    const control = createExecutionControl({
      userToken: "token",
      apiService: { fetch: serviceFetchMock },
      timeoutSeconds: 1,
    });

    await vi.advanceTimersByTimeAsync(1100);

    await expect(
      control.checkpoint("Sandbox run cancelled during execution"),
    ).rejects.toBeInstanceOf(SandboxTimeoutError);
  });

  it("waits while paused and emits paused/resumed events", async () => {
    vi.useFakeTimers();
    const serviceFetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        toJsonResponse({
          runId: "run-1",
          state: "paused",
          updatedAt: "2026-02-17T12:00:00.000Z",
        }),
      )
      .mockResolvedValueOnce(
        toJsonResponse({
          runId: "run-1",
          state: "paused",
          updatedAt: "2026-02-17T12:00:02.000Z",
        }),
      )
      .mockResolvedValueOnce(
        toJsonResponse({
          runId: "run-1",
          state: "running",
          updatedAt: "2026-02-17T12:00:04.000Z",
        }),
      );

    const emitEvent = vi.fn();
    const control = createExecutionControl({
      runId: "run-1",
      userToken: "token",
      apiService: { fetch: serviceFetchMock },
      emitEvent,
    });

    const checkpointPromise = control.checkpoint("Sandbox run cancelled during execution");

    await vi.advanceTimersByTimeAsync(4000);
    await checkpointPromise;

    expect(emitEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "run_paused",
        runId: "run-1",
      }),
    );
    expect(emitEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "run_resumed",
        runId: "run-1",
      }),
    );
  });

  it("throws cancellation error when control state is cancelled", async () => {
    const serviceFetchMock = vi.fn().mockResolvedValue(
      toJsonResponse({
        runId: "run-1",
        state: "cancelled",
        updatedAt: "2026-02-17T12:00:00.000Z",
        cancellationReason: "Cancelled from dashboard",
      }),
    );

    const control = createExecutionControl({
      runId: "run-1",
      userToken: "token",
      apiService: { fetch: serviceFetchMock },
    });

    await expect(
      control.checkpoint("Sandbox run cancelled during execution"),
    ).rejects.toBeInstanceOf(SandboxCancellationError);
  });

  it.each([401, 403])(
    "stops at the checkpoint when run authorisation is revoked with %s",
    async (status) => {
      const serviceFetchMock = vi.fn().mockResolvedValue(toJsonResponse({}, status));
      const control = createExecutionControl({
        runId: "run-1",
        userToken: "revoked-token",
        apiService: { fetch: serviceFetchMock },
      });

      await expect(control.checkpoint("Sandbox run cancelled before commit")).rejects.toMatchObject(
        {
          name: "SandboxCancellationError",
          message: "Sandbox run authorisation was revoked",
        },
      );
    },
  );

  it("does not treat a transient control-plane failure as revoked authorisation", async () => {
    const serviceFetchMock = vi.fn().mockResolvedValue(toJsonResponse({}, 503));
    const control = createExecutionControl({
      runId: "run-1",
      userToken: "token",
      apiService: { fetch: serviceFetchMock },
    });

    await expect(
      control.checkpoint("Sandbox run cancelled during execution"),
    ).resolves.toBeUndefined();
  });
});
