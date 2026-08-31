import { describe, expect, it } from "vitest";

import {
  buildCartesiaRealtimeUpstreamUrl,
  CARTESIA_STT_API_VERSION,
  toCartesiaClientMessage,
  toCartesiaUpstreamMessage,
} from "./cartesia";

describe("Cartesia realtime protocol", () => {
  it("connects Ink 2 to the current semantic-turn endpoint", () => {
    const url = buildCartesiaRealtimeUpstreamUrl({ delay: "low", model: "ink-2" });

    expect(url.origin).toBe("https://api.cartesia.ai");
    expect(url.pathname).toBe("/stt/turns/websocket");
    expect(url.searchParams.get("model")).toBe("ink-2");
    expect(url.searchParams.get("encoding")).toBe("pcm_s16le");
    expect(url.searchParams.get("sample_rate")).toBe("16000");
    expect(url.searchParams.get("cartesia_version")).toBe(CARTESIA_STT_API_VERSION);
    expect(url.searchParams.get("turn_end_timeout_ms")).toBe("1600");
  });

  it("forwards raw PCM and drains buffered audio with Cartesia's close command", () => {
    const audio = toCartesiaUpstreamMessage({
      type: "input_audio.append",
      audio: "AAE=",
    });

    expect(audio).toBeInstanceOf(ArrayBuffer);
    expect(Array.from(new Uint8Array(audio as ArrayBuffer))).toEqual([0, 1]);
    expect(toCartesiaUpstreamMessage({ type: "input_audio.flush" })).toBeNull();
    expect(toCartesiaUpstreamMessage({ type: "input_audio.end" })).toBe(
      JSON.stringify({ type: "close" }),
    );
  });

  it("preserves Cartesia turn lifecycle events for the shared client parser", () => {
    const event = JSON.stringify({
      type: "turn.end",
      transcript: "Book the train.",
      request_id: "request-1",
    });

    expect(toCartesiaClientMessage(event)).toBe(event);
  });
});
