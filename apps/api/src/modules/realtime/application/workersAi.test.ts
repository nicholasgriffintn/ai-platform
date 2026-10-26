import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv, IUser } from "~/types";

import {
  createWorkersAiRealtimeProxyResponse,
  toWorkersAiFluxClientMessage,
  toWorkersAiFluxUpstreamMessage,
} from "./workersAi";

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
  created_at: "2026-10-26T09:00:00.000Z",
  updated_at: "2026-10-26T09:00:00.000Z",
  setup_at: "2026-10-26T09:00:00.000Z",
  terms_accepted_at: "2026-10-26T09:00:00.000Z",
  plan_id: "pro",
};

describe("Workers AI Flux realtime protocol", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRealtimeProvider.mockReturnValue({
      descriptor: { shortLabel: "Workers AI" },
      getDefaultModel: vi.fn().mockReturnValue("@cf/deepgram/flux"),
      models: ["@cf/deepgram/flux"],
    });
    mocks.createRealtimeTranscriptionProxyResponse.mockResolvedValue(
      new Response(null, { status: 204 }),
    );
  });

  it("opens Flux through the AI binding with the turn timeout for the chosen delay", async () => {
    const run = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const env: IEnv = Object.assign(Object.create(null), { AI: { run } });
    const app = new Hono();

    app.get("/", (context) =>
      createWorkersAiRealtimeProxyResponse({
        context,
        delay: "low",
        env,
        model: "@cf/deepgram/flux",
        user,
      }),
    );

    await app.request("https://api.polychat.test/");
    const [{ connectUpstream }] = mocks.createRealtimeTranscriptionProxyResponse.mock.calls[0];

    await connectUpstream();

    expect(run).toHaveBeenCalledWith(
      "@cf/deepgram/flux",
      { encoding: "linear16", sample_rate: "16000", eot_timeout_ms: "1600" },
      { websocket: true },
    );
  });

  it("maps Flux turn events onto the shared turn events", () => {
    expect(
      toWorkersAiFluxClientMessage(JSON.stringify({ event: "Update", transcript: "Book the" })),
    ).toBe(JSON.stringify({ type: "turn.update", transcript: "Book the" }));
    expect(
      toWorkersAiFluxClientMessage(
        JSON.stringify({ event: "EndOfTurn", transcript: "Book the train." }),
      ),
    ).toBe(JSON.stringify({ type: "turn.end", transcript: "Book the train." }));
    expect(toWorkersAiFluxClientMessage(JSON.stringify({ type: "Connected" }))).toBeUndefined();
    expect(
      toWorkersAiFluxClientMessage(
        JSON.stringify({ type: "TurnInfo", event: "Update", transcript: "" }),
      ),
    ).toBeUndefined();
    expect(
      toWorkersAiFluxClientMessage(JSON.stringify({ type: "Error", description: "Bad audio" })),
    ).toBe(JSON.stringify({ type: "error", error: { message: "Bad audio" } }));
  });

  it("forwards raw PCM and closes the Flux stream on end", () => {
    expect(toWorkersAiFluxUpstreamMessage({ type: "input_audio.append", audio: "AAE=" })).toEqual(
      new Uint8Array([0, 1]).buffer,
    );
    expect(toWorkersAiFluxUpstreamMessage({ type: "input_audio.flush" })).toBeNull();
    expect(toWorkersAiFluxUpstreamMessage({ type: "input_audio.end" })).toBe(
      JSON.stringify({ type: "CloseStream" }),
    );
  });
});
