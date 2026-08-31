import { describe, expect, it } from "vitest";

import { createRealtimeWebSocketResumptionController } from "./live-websocket-resumption";

describe("realtime WebSocket resumption controller", () => {
  it("starts one reconnect with the latest resumable handle", () => {
    const controller = createRealtimeWebSocketResumptionController();

    expect(controller.requestReconnect({ timeLeft: "10s" })).toBeUndefined();
    expect(controller.observeUpdate({ handle: "first-handle", resumable: true })).toEqual({
      handle: "first-handle",
      timeLeft: "10s",
    });
    controller.completeReconnect();
    controller.observeUpdate({ handle: "latest-handle", resumable: true });

    expect(controller.requestReconnect({ timeLeft: "5s" })).toEqual({
      handle: "latest-handle",
      timeLeft: "5s",
    });
    expect(controller.requestReconnect({ timeLeft: "4s" })).toBeUndefined();
  });

  it("allows another reconnect after the replacement connection is ready", () => {
    const controller = createRealtimeWebSocketResumptionController();

    controller.observeUpdate({ handle: "first-handle", resumable: true });
    expect(controller.requestReconnect({})).toEqual({ handle: "first-handle" });
    controller.completeReconnect();
    controller.observeUpdate({ handle: "second-handle", resumable: true });

    expect(controller.requestReconnect({})).toEqual({ handle: "second-handle" });
  });

  it("discards older handles when the provider marks the current state non-resumable", () => {
    const controller = createRealtimeWebSocketResumptionController();

    controller.observeUpdate({ handle: "stale-handle", resumable: true });
    controller.observeUpdate({ resumable: false });

    expect(controller.requestReconnect({ timeLeft: "10s" })).toBeUndefined();
    expect(controller.observeUpdate({ handle: "fresh-handle", resumable: true })).toEqual({
      handle: "fresh-handle",
      timeLeft: "10s",
    });
  });
});
