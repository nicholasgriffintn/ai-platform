import { describe, expect, it, vi } from "vitest";

import { toMistralUpstreamMessage } from "./mistralProtocol";

vi.mock("~/infrastructure/providers/capabilities/realtime", () => ({
  getRealtimeProvider: vi.fn(),
}));

vi.mock("~/infrastructure/providers/capabilities/realtime/providers", () => ({
  getMistralTargetStreamingDelayMs: vi.fn(),
}));

describe("Mistral realtime proxy messages", () => {
  it("normalises JSON and binary audio messages before forwarding them upstream", () => {
    expect(
      toMistralUpstreamMessage(
        JSON.stringify({ type: "input_audio.append", audio: "AQID", ignored: "value" }),
      ),
    ).toBe(JSON.stringify({ type: "input_audio.append", audio: "AQID" }));
    expect(toMistralUpstreamMessage(new Uint8Array([1, 2, 3]).buffer)).toBe(
      JSON.stringify({ type: "input_audio.append", audio: "AQID" }),
    );
    expect(toMistralUpstreamMessage(JSON.stringify({ type: "input_audio.flush" }))).toBe(
      JSON.stringify({ type: "input_audio.flush" }),
    );
  });

  it("rejects unsupported commands and malformed audio before reaching Mistral", () => {
    expect(() => toMistralUpstreamMessage(JSON.stringify({ type: "session.update" }))).toThrow(
      "Unsupported realtime message type",
    );
    expect(() =>
      toMistralUpstreamMessage(JSON.stringify({ type: "input_audio.append", audio: "not base64" })),
    ).toThrow("Invalid realtime audio payload");
  });
});
