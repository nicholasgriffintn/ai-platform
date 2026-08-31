import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv, IUser } from "~/types";

import { createCartesiaRealtimeProxyResponse } from "./cartesia";

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

describe("Cartesia realtime proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRealtimeProvider.mockReturnValue({
      getApiKey: vi.fn().mockResolvedValue("cartesia-api-key"),
      getDefaultModel: vi.fn().mockReturnValue("ink-2"),
    });
    mocks.createRealtimeTranscriptionProxyResponse.mockResolvedValue(
      new Response(null, { status: 204 }),
    );
  });

  it("connects Ink 2 to Cartesia's current automatic turn endpoint", async () => {
    const app = new Hono();

    app.get("/", (context) =>
      createCartesiaRealtimeProxyResponse({
        context,
        env: createEnv(),
        user,
        model: "ink-2",
        language: "en",
      }),
    );

    const response = await app.request("https://api.polychat.test/");

    expect(response.status).toBe(204);
    expect(mocks.createRealtimeTranscriptionProxyResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.anything(),
        providerLabel: "Cartesia",
        upstreamUrl: new URL(
          "https://api.cartesia.ai/stt/turns/websocket?model=ink-2&encoding=pcm_s16le&sample_rate=16000&language=en",
        ),
        headers: {
          "X-API-Key": "cartesia-api-key",
          "Cartesia-Version": "2026-03-01",
        },
      }),
    );
  });
});
