import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv, IUser } from "~/types";
import { AssistantError } from "~/utils/errors";

import realtimeRoutes from "../realtime";

const createSessionMock = vi.hoisted(() => vi.fn());
const createCartesiaRealtimeProxyResponseMock = vi.hoisted(() => vi.fn());
const createElevenLabsRealtimeProxyResponseMock = vi.hoisted(() => vi.fn());
const createMistralRealtimeProxyResponseMock = vi.hoisted(() => vi.fn());
const filterModelsForUserAccessMock = vi.hoisted(() => vi.fn());
const getDefaultModelMock = vi.hoisted(() => vi.fn());
const assertRealtimeProxyGrantMock = vi.hoisted(() => vi.fn());
const releaseReservationMock = vi.hoisted(() => vi.fn());
const listRealtimeLiveProvidersMock = vi.hoisted(() => vi.fn());
const getModelsMock = vi.hoisted(() => vi.fn());

vi.mock("~/lib/providers/capabilities/realtime", () => ({
  getRealtimeProvider: vi.fn(() => ({
    createSession: createSessionMock,
    getDefaultModel: getDefaultModelMock,
  })),
  listRealtimeProviders: vi.fn(() => ["openai", "mistral"]),
  parseRealtimeModalities: vi.fn(() => undefined),
  parseRealtimeTranscriptionDelay: vi.fn(() => undefined),
  parseRealtimeTransport: vi.fn(() => undefined),
}));

vi.mock("~/lib/providers/models", () => ({
  filterModelsForUserAccess: filterModelsForUserAccessMock,
  getModels: getModelsMock,
}));

vi.mock("~/services/realtime/catalogue", () => ({
  listRealtimeLiveProviders: listRealtimeLiveProvidersMock,
}));

vi.mock("~/lib/realtime/proxy-grant", () => ({
  assertRealtimeProxyGrant: assertRealtimeProxyGrantMock,
  connectReservedRealtimeProxy: (
    reservation: { release: () => Promise<void> },
    connect: (onSessionEnd: () => Promise<void>) => Promise<Response>,
  ) => connect(reservation.release),
}));

vi.mock("~/services/realtime/mistral", () => ({
  createMistralRealtimeProxyResponse: createMistralRealtimeProxyResponseMock,
}));

vi.mock("~/services/realtime/elevenlabs", () => ({
  createElevenLabsRealtimeProxyResponse: createElevenLabsRealtimeProxyResponseMock,
}));

vi.mock("~/services/realtime/cartesia", () => ({
  createCartesiaRealtimeProxyResponse: createCartesiaRealtimeProxyResponseMock,
}));

const testUser: IUser = {
  id: 42,
  name: "Test User",
  avatar_url: null,
  email: "test@example.com",
  github_username: null,
  company: null,
  site: null,
  location: null,
  bio: null,
  twitter_username: null,
  created_at: "2026-06-02T00:00:00.000Z",
  updated_at: "2026-06-02T00:00:00.000Z",
  setup_at: null,
  terms_accepted_at: null,
  plan_id: "free",
};
const testEnv = {
  ALWAYS_ENABLED_PROVIDERS: "workers-ai",
} satisfies Pick<IEnv, "ALWAYS_ENABLED_PROVIDERS">;

function makeModel(
  id: string,
  provider: string,
  overrides: Partial<ModelConfigItem> = {},
): ModelConfigItem {
  return {
    id,
    matchingModel: id,
    name: id,
    provider,
    isFree: true,
    ...overrides,
  };
}

function createApp(user: IUser | null = testUser) {
  const app = new Hono<{
    Variables: {
      user: IUser;
    };
  }>();

  app.use("/realtime/*", async (c, next) => {
    if (user) {
      c.set("user", user);
    }

    await next();
  });

  app.route("/realtime", realtimeRoutes);
  app.onError((error, c) => {
    if (error instanceof AssistantError && error.statusCode === 401) {
      return c.json({ status: "error", message: error.message }, 401);
    }

    throw error;
  });

  return app;
}

function requestApp(request: Request, user: IUser = testUser) {
  return createApp(user).request(request, undefined, testEnv);
}

describe("realtime routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDefaultModelMock.mockReturnValue("gpt-realtime-2");
    releaseReservationMock.mockResolvedValue(undefined);
    assertRealtimeProxyGrantMock.mockResolvedValue({ release: releaseReservationMock });
    filterModelsForUserAccessMock.mockImplementation(async (models) => models);
  });

  it("requires and verifies a session-bound grant before opening a provider proxy", async () => {
    createMistralRealtimeProxyResponseMock.mockResolvedValue(new Response("connected"));

    const response = await createApp().request(
      new Request(
        "https://api.polychat.test/realtime/mistral/transcription?grant=signed&session_id=session-1&model=voxtral-mini-transcribe-realtime-2602&delay=low",
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(assertRealtimeProxyGrantMock).toHaveBeenCalledWith(
      expect.objectContaining({
        grant: "signed",
        model: "voxtral-mini-transcribe-realtime-2602",
        provider: "mistral",
        sessionId: "session-1",
        user: testUser,
      }),
    );
    expect(createMistralRealtimeProxyResponseMock).toHaveBeenCalledOnce();
  });

  it("rejects a proxy request without a grant before provider connection", async () => {
    const response = await createApp().request(
      new Request(
        "https://api.polychat.test/realtime/mistral/transcription?session_id=session-1&model=voxtral-mini-transcribe-realtime-2602",
      ),
    );

    expect(response.status).toBe(400);
    expect(assertRealtimeProxyGrantMock).not.toHaveBeenCalled();
    expect(createMistralRealtimeProxyResponseMock).not.toHaveBeenCalled();
  });

  it("returns the registry-owned realtime provider catalogue", async () => {
    listRealtimeLiveProvidersMock.mockResolvedValue([
      {
        id: "openai",
        order: 0,
        label: "OpenAI Realtime",
        shortLabel: "OpenAI",
        liveMode: "native",
        transport: "webrtc",
        sessionType: "realtime",
        inputModalities: ["audio"],
        outputModalities: ["audio"],
        description: "WebRTC voice agent",
        defaultModelId: "gpt-realtime-2",
        available: true,
        readiness: "ready",
        availabilityReason: "OpenAI is ready.",
      },
    ]);

    const response = await createApp().request(
      new Request("https://api.polychat.test/realtime/providers"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      providers: [expect.objectContaining({ id: "openai", readiness: "ready" })],
    });
    expect(listRealtimeLiveProvidersMock).toHaveBeenCalledOnce();
  });

  it("rejects anonymous provider readiness requests", async () => {
    const response = await createApp(null).request(
      new Request("https://api.polychat.test/realtime/providers"),
    );

    expect(response.status).toBe(401);
    expect(listRealtimeLiveProvidersMock).not.toHaveBeenCalled();
  });

  it("blocks session creation when the user cannot access the realtime model", async () => {
    getModelsMock.mockReturnValue({
      "gpt-realtime-2": makeModel("gpt-realtime-2", "openai", { isFree: false }),
    });

    const response = await requestApp(
      new Request("https://api.polychat.test/realtime/session/realtime?provider=openai", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      status: "error",
      message: "Model not found or user does not have access",
    });
    expect(createSessionMock).not.toHaveBeenCalled();
  });

  it("allows session creation when the default realtime model is accessible", async () => {
    getModelsMock.mockReturnValue({
      "gpt-realtime-2": makeModel("gpt-realtime-2", "openai"),
    });
    createSessionMock.mockResolvedValue({
      id: "session_123",
      provider: "openai",
      transport: "webrtc",
    });

    const response = await requestApp(
      new Request("https://api.polychat.test/realtime/session/realtime?provider=openai", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      id: "session_123",
      provider: "openai",
      transport: "webrtc",
      max_session_seconds: 1800,
    });
    expect(createSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-realtime-2",
        type: "realtime",
        user: testUser,
      }),
    );
    expect(filterModelsForUserAccessMock).toHaveBeenCalledWith(
      expect.objectContaining({ "gpt-realtime-2": expect.any(Object) }),
      testEnv,
      testUser.id,
      { shouldUseCache: false },
    );
  });

  it("passes the checked catalogue ID when the provider translates its matching model", async () => {
    getModelsMock.mockReturnValue({
      "voxtral-mini-transcribe-realtime": makeModel(
        "voxtral-mini-transcribe-realtime-2602",
        "mistral",
      ),
    });
    createSessionMock.mockResolvedValue({ id: "session_123" });

    const response = await requestApp(
      new Request(
        "https://api.polychat.test/realtime/session/transcription?provider=mistral&model=voxtral-mini-transcribe-realtime",
        { method: "POST" },
      ),
    );

    expect(response.status).toBe(200);
    expect(createSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "voxtral-mini-transcribe-realtime",
      }),
    );
  });

  it("blocks composed pipeline creation when any stage model is inaccessible", async () => {
    getModelsMock.mockReturnValue({
      "voxtral-mini-transcribe-realtime": makeModel(
        "voxtral-mini-transcribe-realtime-2602",
        "mistral",
      ),
      "deepseek-v4-flash": makeModel("deepseek-v4-flash", "deepseek"),
    });
    createSessionMock.mockResolvedValue({
      id: "transcription_session_123",
      object: "realtime.transcription.session",
      provider: "mistral",
      transport: "websocket",
    });

    const response = await requestApp(
      new Request("https://api.polychat.test/realtime/pipeline/session", {
        method: "POST",
        body: JSON.stringify({
          input: {
            provider: "mistral",
            model: "voxtral-mini-transcribe-realtime",
          },
          reasoning: {
            provider: "deepseek",
            model: "deepseek-v4-flash",
          },
          output: {
            provider: "cartesia",
            model: "sonic-3",
          },
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      status: "error",
      message: "Output model not found or user does not have access",
    });
    expect(createSessionMock).not.toHaveBeenCalled();
  });

  it("blocks composed pipeline creation when any stage provider does not match its model", async () => {
    getModelsMock.mockReturnValue({
      "voxtral-mini-transcribe-realtime": makeModel(
        "voxtral-mini-transcribe-realtime-2602",
        "mistral",
      ),
      "deepseek-v4-flash": makeModel("deepseek-v4-flash", "deepseek"),
      "sonic-3": makeModel("sonic-3", "cartesia"),
    });

    const response = await requestApp(
      new Request("https://api.polychat.test/realtime/pipeline/session", {
        method: "POST",
        body: JSON.stringify({
          input: {
            provider: "mistral",
            model: "voxtral-mini-transcribe-realtime",
          },
          reasoning: {
            provider: "bogus",
            model: "deepseek-v4-flash",
          },
          output: {
            provider: "cartesia",
            model: "sonic-3",
          },
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      status: "error",
      message: "Reasoning model not found or user does not have access",
    });
    expect(createSessionMock).not.toHaveBeenCalled();
  });

  it("does not authorise a realtime model through another provider's matching identifier", async () => {
    getModelsMock.mockReturnValue({
      "shared-realtime": makeModel("upstream-realtime", "other-provider"),
    });

    const response = await requestApp(
      new Request(
        "https://api.polychat.test/realtime/session/realtime?provider=openai&model=upstream-realtime",
        { method: "POST" },
      ),
    );

    expect(response.status).toBe(403);
    expect(createSessionMock).not.toHaveBeenCalled();
  });

  it("blocks composed pipeline creation when a stage model belongs to another provider", async () => {
    getModelsMock.mockReturnValue({
      "voxtral-mini-transcribe-realtime": makeModel(
        "voxtral-mini-transcribe-realtime-2602",
        "mistral",
      ),
      "deepseek-v4-flash": makeModel("deepseek-v4-flash", "deepseek"),
      "sonic-3": makeModel("sonic-3", "cartesia"),
    });

    const response = await requestApp(
      new Request("https://api.polychat.test/realtime/pipeline/session", {
        method: "POST",
        body: JSON.stringify({
          input: {
            provider: "mistral",
            model: "voxtral-mini-transcribe-realtime",
          },
          reasoning: {
            provider: "deepseek",
            model: "deepseek-v4-flash",
          },
          output: {
            provider: "mistral",
            model: "sonic-3",
          },
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      status: "error",
      message: "Output model not found or user does not have access",
    });
    expect(createSessionMock).not.toHaveBeenCalled();
  });

  it("creates a composed pipeline session with validated stage models", async () => {
    getModelsMock.mockReturnValue({
      "voxtral-mini-transcribe-realtime": makeModel(
        "voxtral-mini-transcribe-realtime-2602",
        "mistral",
      ),
      "deepseek-v4-flash": makeModel("deepseek-v4-flash", "deepseek"),
      "sonic-3": makeModel("sonic-3", "cartesia"),
    });
    createSessionMock.mockResolvedValue({
      id: "transcription_session_123",
      object: "realtime.transcription.session",
      provider: "mistral",
      transport: "websocket",
    });

    const response = await requestApp(
      new Request("https://api.polychat.test/realtime/pipeline/session", {
        method: "POST",
        body: JSON.stringify({
          input: {
            provider: "mistral",
            model: "voxtral-mini-transcribe-realtime",
          },
          reasoning: {
            provider: "deepseek",
            model: "deepseek-v4-flash",
          },
          output: {
            provider: "cartesia",
            model: "sonic-3",
            voice: "sonic-3",
          },
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      id: expect.any(String),
      object: "realtime.pipeline.session",
      type: "pipeline",
      live_mode: "composed",
      input: {
        provider: "mistral",
        model: "voxtral-mini-transcribe-realtime",
        session: {
          id: "transcription_session_123",
          object: "realtime.transcription.session",
          provider: "mistral",
          transport: "websocket",
        },
      },
      reasoning: {
        provider: "deepseek",
        model: "deepseek-v4-flash",
      },
      output: {
        provider: "cartesia",
        model: "sonic-3",
        voice: "sonic-3",
      },
      latency_profile: "balanced",
    });
    expect(createSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "voxtral-mini-transcribe-realtime",
        type: "transcription",
        user: testUser,
      }),
    );
  });
});
