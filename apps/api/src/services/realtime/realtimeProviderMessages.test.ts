import { describe, expect, it, vi } from "vitest";

import { toCartesiaClientMessage, toCartesiaUpstreamMessage } from "./cartesia";
import {
  createElevenLabsClientMessageMapper,
  createElevenLabsUpstreamMessageMapper,
} from "./elevenlabs";
import { isMistralSessionCreatedMessage, toMistralUpstreamMessage } from "./mistralProtocol";

vi.mock("~/lib/providers/capabilities/realtime", () => ({
  getRealtimeProvider: vi.fn(),
}));

vi.mock("~/lib/providers/capabilities/realtime/providers", () => ({
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

  it("recognises only the Mistral session-created response fixture", () => {
    expect(isMistralSessionCreatedMessage(JSON.stringify({ type: "session.created" }))).toBe(true);
    expect(
      isMistralSessionCreatedMessage(JSON.stringify({ type: "transcription.text.delta" })),
    ).toBe(false);
    expect(isMistralSessionCreatedMessage("{")).toBe(false);
  });
});

describe("ElevenLabs realtime proxy messages", () => {
  it("commits only after enough PCM audio has reached the upstream mapper", () => {
    const toUpstream = createElevenLabsUpstreamMessageMapper();
    const shortAudio = Buffer.alloc(320).toString("base64");
    const commitReadyAudio = Buffer.alloc(9600).toString("base64");

    expect(toUpstream({ type: "input_audio.append", audio: shortAudio })).toBe(
      JSON.stringify({
        message_type: "input_audio_chunk",
        audio_base_64: shortAudio,
        commit: false,
        sample_rate: 16000,
      }),
    );
    expect(toUpstream({ type: "input_audio.flush" })).toBeNull();
    expect(toUpstream({ type: "input_audio.append", audio: commitReadyAudio })).toBe(
      JSON.stringify({
        message_type: "input_audio_chunk",
        audio_base_64: commitReadyAudio,
        commit: false,
        sample_rate: 16000,
      }),
    );
    expect(toUpstream({ type: "input_audio.flush" })).toBe(
      JSON.stringify({
        message_type: "input_audio_chunk",
        commit: true,
        sample_rate: 16000,
      }),
    );
  });

  it("maps partial and committed ElevenLabs transcripts to one correlated segment", () => {
    const toClient = createElevenLabsClientMessageMapper();
    const partial = JSON.parse(
      toClient(JSON.stringify({ message_type: "partial_transcript", text: "Book the" })) as string,
    );
    const committed = (
      toClient(
        JSON.stringify({ message_type: "committed_transcript", text: "Book the train." }),
      ) as string[]
    ).map((message) => JSON.parse(message));

    expect(partial).toEqual({
      type: "transcription.text",
      item_id: expect.stringMatching(/^elevenlabs-/),
      text: "Book the",
    });
    expect(committed).toEqual([
      {
        type: "transcription.segment",
        item_id: partial.item_id,
        text: "Book the train.",
      },
      { type: "transcription.done", item_id: partial.item_id },
    ]);
  });
});

describe("Cartesia realtime proxy messages", () => {
  it("maps normalised client audio and shutdown controls to the auto-turn wire protocol", () => {
    expect(
      new Uint8Array(
        toCartesiaUpstreamMessage({ type: "input_audio.append", audio: "AQID" }) as ArrayBuffer,
      ),
    ).toEqual(new Uint8Array([1, 2, 3]));
    expect(toCartesiaUpstreamMessage({ type: "input_audio.flush" })).toBeNull();
    expect(toCartesiaUpstreamMessage({ type: "input_audio.end" })).toBe(
      JSON.stringify({ type: "close" }),
    );
  });

  it("maps Cartesia transcript lifecycle fixtures to normalised client events", () => {
    const firstUpdate = toCartesiaClientMessage(
      JSON.stringify({
        type: "turn.update",
        transcript: "Good",
        request_id: "cartesia-turn-1",
      }),
    );
    const secondUpdate = toCartesiaClientMessage(
      JSON.stringify({
        type: "turn.update",
        transcript: "Good morning",
        request_id: "cartesia-turn-1",
      }),
    );

    expect(typeof firstUpdate).toBe("string");
    expect(typeof secondUpdate).toBe("string");
    if (typeof firstUpdate !== "string" || typeof secondUpdate !== "string") {
      throw new Error("Cartesia turn update fixture did not produce a client message");
    }

    expect([firstUpdate, secondUpdate].map((message) => JSON.parse(message))).toEqual([
      {
        type: "transcription.text",
        item_id: "cartesia-turn-1",
        text: "Good",
      },
      {
        type: "transcription.text",
        item_id: "cartesia-turn-1",
        text: "Good morning",
      },
    ]);
    const end = toCartesiaClientMessage(
      JSON.stringify({
        type: "turn.end",
        transcript: "Good morning.",
        request_id: "cartesia-turn-1",
      }),
    );

    expect(Array.isArray(end)).toBe(true);
    if (!Array.isArray(end)) {
      throw new Error("Cartesia turn end fixture did not produce final client messages");
    }

    expect(end.map((message) => JSON.parse(message))).toEqual([
      {
        type: "transcription.segment",
        item_id: "cartesia-turn-1",
        text: "Good morning.",
      },
      { type: "transcription.done", item_id: "cartesia-turn-1" },
    ]);
  });
});
