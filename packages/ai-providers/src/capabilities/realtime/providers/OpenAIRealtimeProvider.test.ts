import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestRuntime } from "../../../__test__/test-runtime.js";
import type { ProviderEnv, ProviderUser } from "../../../env.js";
import { createCatalogueModelResolver } from "../../../model-resolver.js";
import type { RealtimeSessionRequest } from "../index.js";
import { OpenAIRealtimeProvider } from "./OpenAIRealtimeProvider.js";

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

vi.mock("@ngriffin_uk/polychat-utility-server/crypto", () => ({
  sha256Hex: vi.fn(async () => "test-safety-id"),
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
    throw new Error("Expected OpenAI to be called");
  }

  return JSON.parse(String(call[1]?.body));
}

describe("OpenAIRealtimeProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(
      Response.json({
        value: "client-secret",
        expires_at: 1_788_192_000,
        session: { id: "session-1" },
      }),
    );
    getModelConfigByModelMock.mockImplementation(async (model: string) => ({
      provider: "openai",
      matchingModel: model === "openai-whisper" ? "whisper-1" : model,
    }));
  });

  it("creates realtime sessions with GPT Realtime 2.1 by default", async () => {
    const provider = new OpenAIRealtimeProvider(runtime);

    await provider.createSession(createRequest());

    expect(getLastRequestBody()).toMatchObject({
      session: {
        type: "realtime",
        model: "gpt-realtime-2.1",
        audio: {
          input: {
            transcription: { model: "gpt-live-transcribe", language: "en" },
          },
        },
      },
    });
  });

  it("uses GPT Live Transcribe and its latency control for live transcription", async () => {
    const provider = new OpenAIRealtimeProvider(runtime);

    await provider.createSession(createRequest({ type: "transcription", delay: "minimal" }));

    expect(getLastRequestBody()).toMatchObject({
      session: {
        type: "transcription",
        audio: {
          input: {
            transcription: {
              model: "gpt-live-transcribe",
              language: "en",
              delay: "minimal",
            },
            turn_detection: null,
          },
        },
      },
    });
  });

  it("keeps semantic turn detection for committed GPT Transcribe turns", async () => {
    const provider = new OpenAIRealtimeProvider(runtime);

    await provider.createSession(createRequest({ type: "transcription", model: "gpt-transcribe" }));

    expect(getLastRequestBody()).toMatchObject({
      session: {
        audio: {
          input: {
            transcription: { model: "gpt-transcribe", language: "en" },
            turn_detection: { type: "semantic_vad", eagerness: "auto" },
          },
        },
      },
    });
  });
});
