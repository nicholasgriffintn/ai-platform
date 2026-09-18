import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestRuntime } from "../../../__test__/test-runtime.js";
import type { ProviderEnv, ProviderUser } from "../../../env.js";
import { createCatalogueModelResolver } from "../../../model-resolver.js";
import type { RealtimeSessionRequest } from "../index.js";
import { GoogleRealtimeProvider } from "./GoogleRealtimeProvider.js";

const fetchMock = vi.hoisted(() =>
  vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(),
);
const getModelConfigByModelMock = vi.hoisted(() => vi.fn());

const runtime = createTestRuntime({
  models: { ...createCatalogueModelResolver(), getModelConfigByModel: getModelConfigByModelMock },
});

vi.mock("../../../credentials.js", () => ({
  resolveHostProviderApiKey: vi.fn(async () => "test-api-key"),
}));

const testUser: ProviderUser = {
  id: 42,
  email: "test@example.com",
  plan_id: "pro",
};

function createTestEnv(): ProviderEnv {
  return Object.assign(Object.create(null), {});
}

function createRequest(overrides: Partial<RealtimeSessionRequest> = {}): RealtimeSessionRequest {
  return {
    env: createTestEnv(),
    user: testUser,
    type: "realtime",
    ...overrides,
  };
}

function getLastRequestBody() {
  const call = fetchMock.mock.calls.at(-1);

  if (!call) {
    throw new Error("Expected Gemini to be called");
  }

  return JSON.parse(String(call[1]?.body));
}

describe("GoogleRealtimeProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-31T12:00:00.000Z"));
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(
      Response.json({
        name: "ephemeral-token",
        expireTime: "2026-08-31T14:00:00.000Z",
        newSessionExpireTime: "2026-08-31T12:01:00.000Z",
      }),
    );
    getModelConfigByModelMock.mockResolvedValue({
      provider: "google-ai-studio",
      matchingModel: "gemini-3.1-flash-live-preview",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("creates a constrained v1beta token with long-session controls", async () => {
    const provider = new GoogleRealtimeProvider(runtime);

    const session = await provider.createSession(createRequest());

    expect(fetchMock).toHaveBeenCalledWith(
      "https://generativelanguage.googleapis.com/v1beta/auth_tokens",
      expect.objectContaining({ method: "POST" }),
    );
    expect(getLastRequestBody()).toMatchObject({
      uses: 1,
      expireTime: "2026-08-31T14:00:00.000Z",
      newSessionExpireTime: "2026-08-31T12:01:00.000Z",
      liveConnectConstraints: {
        model: "models/gemini-3.1-flash-live-preview",
        config: {
          responseModalities: ["AUDIO"],
          sessionResumption: {},
          contextWindowCompression: { slidingWindow: {} },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
      },
    });
    expect(session).toMatchObject({
      provider: "google-ai-studio",
      protocol: "gemini-live",
      transport: "websocket",
      url: expect.stringContaining(
        "google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained",
      ),
      setup: {
        model: "models/gemini-3.1-flash-live-preview",
        sessionResumption: {},
        contextWindowCompression: { slidingWindow: {} },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      },
    });
  });
});
