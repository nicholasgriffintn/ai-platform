import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";

import { REALTIME_MAX_SESSION_SECONDS_MAX, REALTIME_PROXY_LIMITS } from "~/config/realtime";

import {
  bridgeRealtimeTranscriptionSockets,
  connectRealtimeWebSocketUpstream,
  createRealtimeTranscriptionProxyResponse,
  normalizeClientRealtimeMessage,
  RealtimeProxyLimitError,
  RealtimeProxySessionLimits,
} from "../transcriptionProxy";

type SocketEvent = { code?: number; data?: unknown; reason?: string };

class FakeSocket {
  readyState = 1;
  closed?: { code: number; reason: string };
  private readonly listeners = new Map<string, ((event: SocketEvent) => void)[]>();

  addEventListener(type: string, listener: (event: SocketEvent) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  close(code = 1000, reason = ""): void {
    this.readyState = 3;
    this.closed = { code, reason };
  }

  emit(type: string, event: SocketEvent = {}): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }

  send(): void {}
}

describe("realtime transcription proxy limits", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("counts decoded audio bytes and rejects an oversized frame", () => {
    const limits = new RealtimeProxySessionLimits();
    const oversizedAudio = new Uint8Array(REALTIME_PROXY_LIMITS.audioFrameBytes + 1).buffer;

    expect(() => normalizeClientRealtimeMessage(oversizedAudio, limits)).toThrow(
      RealtimeProxyLimitError,
    );
  });

  it("caps total audio for a session", () => {
    const limits = new RealtimeProxySessionLimits();

    let consumed = 0;

    while (
      consumed + REALTIME_PROXY_LIMITS.audioFrameBytes <=
      REALTIME_PROXY_LIMITS.sessionAudioBytes
    ) {
      limits.recordAudioFrame(REALTIME_PROXY_LIMITS.audioFrameBytes);
      consumed += REALTIME_PROXY_LIMITS.audioFrameBytes;
    }

    const remainder = REALTIME_PROXY_LIMITS.sessionAudioBytes - consumed;

    if (remainder > 0) {
      limits.recordAudioFrame(remainder);
    }

    expect(limits.summary().audioSeconds).toBe(REALTIME_MAX_SESSION_SECONDS_MAX);
    expect(() => limits.recordAudioFrame(1)).toThrow("Realtime session audio limit reached");
  });

  it("caps the pending pre-session queue by frame count", () => {
    const limits = new RealtimeProxySessionLimits();

    for (let index = 0; index < REALTIME_PROXY_LIMITS.pendingFrames; index += 1) {
      limits.addPendingFrame("frame");
    }

    expect(() => limits.addPendingFrame("one-too-many")).toThrow(
      "Realtime pending queue limit reached",
    );
  });

  it("rejects unsupported client messages", () => {
    expect(() =>
      normalizeClientRealtimeMessage(JSON.stringify({ type: "session.update" })),
    ).toThrow("Unsupported realtime message type");
  });

  it("caps control messages", () => {
    const limits = new RealtimeProxySessionLimits();

    for (let index = 0; index < REALTIME_PROXY_LIMITS.controlMessages; index += 1) {
      normalizeClientRealtimeMessage(JSON.stringify({ type: "input_audio.flush" }), limits);
    }

    expect(() =>
      normalizeClientRealtimeMessage(JSON.stringify({ type: "input_audio.flush" }), limits),
    ).toThrow("Realtime control message limit reached");
  });

  it("releases the reservation with the measured audio when the client socket closes", async () => {
    vi.stubGlobal("WebSocket", { CONNECTING: 0, OPEN: 1 });
    const client = new FakeSocket();
    const upstream = new FakeSocket();
    const release = vi.fn().mockResolvedValue(undefined);

    bridgeRealtimeTranscriptionSockets({
      client: client as unknown as WebSocket,
      upstream: upstream as unknown as WebSocket,
      onSessionEnd: release,
      toUpstreamMessage: () => null,
      toClientMessage: () => undefined,
    });
    client.emit("message", { data: new ArrayBuffer(32_000 * 2 + 1) });
    client.emit("close", { code: 1000, reason: "done" });

    await vi.waitFor(() => expect(release).toHaveBeenCalledOnce());
    expect(release).toHaveBeenCalledWith({ audioBytes: 64_001, audioSeconds: 3 });
    expect(upstream.closed).toEqual({ code: 1000, reason: "" });
  });

  it("does not expose provider response details on handshake failure", async () => {
    const providerSecret = "provider-secret-body";
    const correlationId = "provider-correlation-secret";
    const app = new Hono();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(providerSecret, {
          status: 401,
          headers: { "mistral-correlation-id": correlationId },
        }),
      ),
    );
    app.get("/", (context) =>
      createRealtimeTranscriptionProxyResponse({
        context,
        providerLabel: "Provider",
        connectUpstream: connectRealtimeWebSocketUpstream(
          new URL("https://provider.example/realtime"),
          { Authorization: "Bearer provider-key" },
        ),
        toUpstreamMessage: () => null,
        toClientMessage: () => undefined,
      }),
    );

    const response = await app.request("https://api.polychat.test/", {
      headers: { Upgrade: "websocket" },
    });
    const body = await response.text();

    expect(response.status).toBe(401);
    expect(body).toContain("Provider realtime connection failed");
    expect(body).not.toContain(providerSecret);
    expect(body).not.toContain(correlationId);
  });
});
