import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv, IUser } from "~/types";

import {
  buildGreenPtRealtimeUpstreamUrl,
  createGreenPtRealtimeProxyResponse,
  toGreenPtClientMessage,
  toGreenPtUpstreamMessage,
} from "./greenpt";

const mocks = vi.hoisted(() => ({
  createRealtimeTranscriptionProxyResponse: vi.fn(),
  getRealtimeProvider: vi.fn(),
}));

vi.mock("~/infrastructure/providers/capabilities/realtime", () => ({
  getRealtimeProvider: mocks.getRealtimeProvider,
}));

vi.mock("./transcriptionProxy", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./transcriptionProxy")>()),
  createRealtimeTranscriptionProxyResponse: mocks.createRealtimeTranscriptionProxyResponse,
}));

const user: IUser = {
  id: 42,
  name: "Realtime Tester",
  avatar_url: null,
  email: "realtime@example.com",
  github_username: null,
  company: null,
  site: null,
  location: null,
  bio: null,
  twitter_username: null,
  created_at: "2026-08-31T09:00:00.000Z",
  updated_at: "2026-08-31T09:00:00.000Z",
  setup_at: "2026-08-31T09:00:00.000Z",
  terms_accepted_at: "2026-08-31T09:00:00.000Z",
  plan_id: "pro",
};

function createEnv(): IEnv {
  return Object.assign(Object.create(null), {});
}

describe("GreenPT realtime protocol", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRealtimeProvider.mockReturnValue({
      getApiKey: vi.fn().mockResolvedValue("greenpt-api-key"),
      getDefaultModel: vi.fn().mockReturnValue("green-s"),
      models: ["green-s", "green-s-pro"],
    });
    mocks.createRealtimeTranscriptionProxyResponse.mockResolvedValue(
      new Response(null, { status: 204 }),
    );
  });

  it("connects to the live listen endpoint with linear16 audio and language", () => {
    const url = buildGreenPtRealtimeUpstreamUrl({ model: "green-s-pro", language: "multi" });

    expect(url.origin).toBe("wss://api.greenpt.ai");
    expect(url.pathname).toBe("/v1/listen");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      model: "green-s-pro",
      encoding: "linear16",
      sample_rate: "16000",
      language: "multi",
      punctuate: "true",
      interim_results: "true",
    });
  });

  it("passes Token auth and session cleanup to the shared proxy", async () => {
    const onSessionEnd = vi.fn();
    const app = new Hono();

    app.get("/", (context) =>
      createGreenPtRealtimeProxyResponse({
        context,
        env: createEnv(),
        model: "green-s",
        onSessionEnd,
        user,
      }),
    );

    const response = await app.request("https://api.polychat.test/");

    expect(response.status).toBe(204);
    expect(mocks.createRealtimeTranscriptionProxyResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        providerLabel: "GreenPT",
        headers: { Authorization: "Token greenpt-api-key" },
        onSessionEnd,
      }),
    );
  });

  it("rejects models the provider does not advertise", async () => {
    const app = new Hono();

    app.get("/", (context) =>
      createGreenPtRealtimeProxyResponse({ context, env: createEnv(), model: "nova-2", user }),
    );

    const response = await app.request("https://api.polychat.test/");

    expect(response.status).toBe(400);
    expect(mocks.createRealtimeTranscriptionProxyResponse).not.toHaveBeenCalled();
  });

  it("forwards raw PCM and closes the stream on end", () => {
    const audio = toGreenPtUpstreamMessage({ type: "input_audio.append", audio: "AAE=" });

    if (!(audio instanceof ArrayBuffer)) {
      throw new Error("Expected GreenPT audio to be decoded into an ArrayBuffer");
    }

    expect(Array.from(new Uint8Array(audio))).toEqual([0, 1]);
    expect(toGreenPtUpstreamMessage({ type: "input_audio.flush" })).toBeNull();
    expect(toGreenPtUpstreamMessage({ type: "input_audio.end" })).toBe(
      JSON.stringify({ type: "CloseStream" }),
    );
  });

  it("maps Deepgram-shaped results onto the shared transcription events", () => {
    const results = (isFinal: boolean, transcript: string) =>
      JSON.stringify({
        type: "Results",
        is_final: isFinal,
        channel: { alternatives: [{ transcript }] },
      });

    expect(toGreenPtClientMessage(results(false, "book the"))).toBe(
      JSON.stringify({ type: "transcription.text.delta", text: "book the" }),
    );
    expect(toGreenPtClientMessage(results(true, "book the train"))).toBe(
      JSON.stringify({ type: "transcription.segment", text: "book the train" }),
    );
    expect(toGreenPtClientMessage(results(true, ""))).toBeUndefined();
    expect(toGreenPtClientMessage(JSON.stringify({ type: "Metadata" }))).toBeUndefined();
    expect(
      toGreenPtClientMessage(JSON.stringify({ type: "Error", description: "bad audio" })),
    ).toBe(JSON.stringify({ type: "error", error: { message: "bad audio" } }));
  });
});
