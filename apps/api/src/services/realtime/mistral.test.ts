import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv, IUser } from "~/types";

import { createMistralRealtimeProxyResponse } from "./mistral";

const mocks = vi.hoisted(() => ({
  getRealtimeProvider: vi.fn(),
  getMistralTargetStreamingDelayMs: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("~/lib/providers/capabilities/realtime", () => ({
  getRealtimeProvider: mocks.getRealtimeProvider,
}));

vi.mock("~/lib/providers/capabilities/realtime/providers", () => ({
  getMistralTargetStreamingDelayMs: mocks.getMistralTargetStreamingDelayMs,
  resolveMistralRealtimeProxyModel: (model?: string) => {
    if (
      model === undefined ||
      model === "voxtral-mini-transcribe-realtime" ||
      model === "voxtral-mini-transcribe-realtime-2602"
    ) {
      return "voxtral-mini-transcribe-realtime-2602";
    }

    return undefined;
  },
}));

vi.mock("~/utils/logger", () => ({
  getLogger: () => ({ error: mocks.loggerError }),
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

describe("Mistral realtime proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRealtimeProvider.mockReturnValue({
      getApiKey: vi.fn().mockResolvedValue("mistral-api-key"),
      getDefaultModel: vi.fn().mockReturnValue("voxtral-default-fixture"),
    });
  });

  it("uses the allowlisted model resolved by the public proxy request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "fixture handshake rejected" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);
    const app = new Hono();

    app.get("/", (context) =>
      createMistralRealtimeProxyResponse({
        context,
        env: createEnv(),
        user,
        model: "voxtral-mini-transcribe-realtime-2602",
      }),
    );

    const response = await app.request("https://api.polychat.test/", {
      headers: { Upgrade: "websocket" },
    });

    expect(response.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledWith(
      new URL(
        "https://api.mistral.ai/v1/audio/transcriptions/realtime?model=voxtral-mini-transcribe-realtime-2602",
      ),
      {
        headers: {
          Authorization: "Bearer mistral-api-key",
          Upgrade: "websocket",
          "user-agent": "polychat-mistral-realtime-proxy/1.0",
        },
      },
    );
  });

  it("rejects an unsupported model before resolving credentials or contacting Mistral", async () => {
    const fetchMock = vi.fn();

    vi.stubGlobal("fetch", fetchMock);
    const app = new Hono();

    app.get("/", (context) =>
      createMistralRealtimeProxyResponse({
        context,
        env: createEnv(),
        user,
        model: "arbitrary-model",
      }),
    );

    const response = await app.request("https://api.polychat.test/", {
      headers: { Upgrade: "websocket" },
    });

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.getRealtimeProvider).toHaveBeenCalledTimes(1);
    expect(mocks.getRealtimeProvider.mock.results[0]?.value.getApiKey).not.toHaveBeenCalled();
  });
});
