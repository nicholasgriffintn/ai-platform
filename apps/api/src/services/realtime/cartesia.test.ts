import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv, IUser } from "~/types";

import {
  buildCartesiaRealtimeUpstreamUrl,
  CARTESIA_STT_API_VERSION,
  createCartesiaRealtimeProxyResponse,
  toCartesiaClientMessage,
  toCartesiaUpstreamMessage,
} from "./cartesia";

const mocks = vi.hoisted(() => ({
  createRealtimeTranscriptionProxyResponse: vi.fn(),
  getRealtimeProvider: vi.fn(),
}));

vi.mock("~/lib/providers/capabilities/realtime", () => ({
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

describe("Cartesia realtime protocol", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRealtimeProvider.mockReturnValue({
      getApiKey: vi.fn().mockResolvedValue("cartesia-api-key"),
      getDefaultModel: vi.fn().mockReturnValue("ink-2"),
      models: ["ink-2"],
    });
    mocks.createRealtimeTranscriptionProxyResponse.mockResolvedValue(
      new Response(null, { status: 204 }),
    );
  });

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

  it("passes the current endpoint and session cleanup to the shared proxy", async () => {
    const onSessionEnd = vi.fn();
    const app = new Hono();

    app.get("/", (context) =>
      createCartesiaRealtimeProxyResponse({
        context,
        delay: "low",
        env: createEnv(),
        model: "ink-2",
        onSessionEnd,
        user,
      }),
    );

    const response = await app.request("https://api.polychat.test/");

    expect(response.status).toBe(204);
    expect(mocks.createRealtimeTranscriptionProxyResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.anything(),
        providerLabel: "Cartesia",
        upstreamUrl: new URL(
          "https://api.cartesia.ai/stt/turns/websocket?model=ink-2&encoding=pcm_s16le&sample_rate=16000&cartesia_version=2026-08-14&turn_end_timeout_ms=1600",
        ),
        headers: {
          "X-API-Key": "cartesia-api-key",
          "Cartesia-Version": CARTESIA_STT_API_VERSION,
        },
        onSessionEnd,
      }),
    );
  });

  it("forwards raw PCM and drains buffered audio with Cartesia's close command", () => {
    const audio = toCartesiaUpstreamMessage({ type: "input_audio.append", audio: "AAE=" });

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
