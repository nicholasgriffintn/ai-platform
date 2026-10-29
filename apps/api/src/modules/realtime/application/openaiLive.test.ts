import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv, IUser } from "~/types";

import { createOpenAILiveCallResponse, readOpenAILiveAnswer } from "./openaiLive";

const mocks = vi.hoisted(() => ({
  getRealtimeProvider: vi.fn(),
  getSystemModel: vi.fn(async () => ({ model: "gpt-6-luna" })),
}));

vi.mock("~/modules/models/application/resolve", () => ({
  getSystemModel: mocks.getSystemModel,
}));

vi.mock("~/infrastructure/providers/capabilities/realtime", () => ({
  getRealtimeProvider: mocks.getRealtimeProvider,
}));

vi.mock("@ngriffin_uk/polychat-utility-server/crypto", () => ({
  sha256Hex: vi.fn(async () => "hashed-user-42"),
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

async function brokerCall(offer: string, fetchMock: ReturnType<typeof vi.fn>) {
  vi.stubGlobal("fetch", fetchMock);
  const app = new Hono();

  app.post("/", (context) =>
    createOpenAILiveCallResponse({
      context,
      env: createEnv(),
      user,
      model: "gpt-live-1",
      instructions: "Be brief.",
      voice: "cedar",
    }),
  );

  return app.request("/", {
    method: "POST",
    body: offer,
    headers: { "Content-Type": "application/sdp" },
  });
}

describe("GPT-Live brokered calls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRealtimeProvider.mockReturnValue({
      getApiKey: vi.fn().mockResolvedValue("openai-api-key"),
      models: ["gpt-realtime-2.1", "gpt-live-1"],
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates the session with the offer and returns the answer as SDP", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json(
        { id: "sess_123", transport: { type: "webrtc", sdp: "answer-sdp" } },
        {
          status: 201,
        },
      ),
    );

    const response = await brokerCall("offer-sdp", fetchMock);

    expect(response.status).toBe(201);
    expect(response.headers.get("Content-Type")).toBe("application/sdp");
    await expect(response.text()).resolves.toBe("answer-sdp");

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];

    expect(url).toBe("https://api.openai.com/v1/live/sessions");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer openai-api-key",
      "OpenAI-Safety-Identifier": "hashed-user-42",
    });
    expect(JSON.parse(String(init.body))).toEqual({
      session: {
        model: "gpt-live-1",
        instructions: "Be brief.",
        audio: { output: { voice: "cedar" } },
        delegation: { type: "responses", responses: { model: "gpt-6-luna" } },
      },
      transport: { type: "webrtc", sdp: "offer-sdp" },
    });
  });

  it("rejects an empty offer before contacting OpenAI", async () => {
    const fetchMock = vi.fn();

    const response = await brokerCall("   ", fetchMock);

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("hides provider failure details and maps the status", async () => {
    const fetchMock = vi.fn(
      async () => new Response("secret provider body", { status: 500, statusText: "Boom" }),
    );

    const response = await brokerCall("offer-sdp", fetchMock);

    expect(response.status).toBe(502);
    await expect(response.text()).resolves.not.toContain("secret provider body");
  });

  it("reads only a well-formed answer", () => {
    expect(readOpenAILiveAnswer({ transport: { sdp: "answer" } })).toBe("answer");
    expect(readOpenAILiveAnswer({ transport: { sdp: "" } })).toBeUndefined();
    expect(readOpenAILiveAnswer({ sdp: "answer" })).toBeUndefined();
  });
});
