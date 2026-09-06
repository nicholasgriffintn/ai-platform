import { afterEach, describe, expect, it, vi } from "vitest";

import { createRealtimeSessionController } from "./live-session-controller";

describe("realtime session controller", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("invalidates and aborts a superseded session", () => {
    const controller = createRealtimeSessionController();
    const first = controller.begin();
    const second = controller.begin();

    expect(first.signal.aborted).toBe(true);
    expect(controller.isCurrent(first)).toBe(false);
    expect(controller.isCurrent(second)).toBe(true);
  });

  it("cancels the current session", () => {
    const controller = createRealtimeSessionController();
    const lease = controller.begin();

    controller.cancel();

    expect(lease.signal.aborted).toBe(true);
    expect(controller.isCurrent(lease)).toBe(false);
  });

  it("invalidates the lease before synchronous abort listeners run", () => {
    const controller = createRealtimeSessionController();
    const lease = controller.begin();
    const wasCurrentDuringAbort = vi.fn(() => controller.isCurrent(lease));

    lease.signal.addEventListener("abort", wasCurrentDuringAbort);
    controller.cancel();

    expect(wasCurrentDuringAbort).toHaveReturnedWith(false);
  });

  it("bounds provider finalization and ignores completion after timeout", () => {
    vi.useFakeTimers();
    const onTimeout = vi.fn();
    const controller = createRealtimeSessionController({ finalizationTimeoutMs: 250 });
    const lease = controller.begin();

    expect(controller.finalize(lease, onTimeout)).toBe(true);
    vi.advanceTimersByTime(250);

    expect(onTimeout).toHaveBeenCalledOnce();
    expect(controller.isCurrent(lease)).toBe(false);
    expect(controller.complete(lease)).toBe(false);
  });

  it("clears finalization when the provider completes in time", () => {
    vi.useFakeTimers();
    const onTimeout = vi.fn();
    const controller = createRealtimeSessionController({ finalizationTimeoutMs: 250 });
    const lease = controller.begin();

    controller.finalize(lease, onTimeout);
    expect(controller.complete(lease)).toBe(true);
    vi.advanceTimersByTime(250);

    expect(onTimeout).not.toHaveBeenCalled();
  });
});
