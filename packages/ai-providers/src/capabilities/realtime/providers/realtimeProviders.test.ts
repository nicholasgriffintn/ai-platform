import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestRuntime } from "../../../__test__/test-runtime.js";
import type { ProviderEnv, ProviderUser } from "../../../env.js";
import { createCatalogueModelResolver } from "../../../model-resolver.js";
import type { RealtimeSessionRequest } from "../index.js";
import { CartesiaRealtimeProvider } from "./CartesiaRealtimeProvider.js";
import { ElevenLabsRealtimeProvider } from "./ElevenLabsRealtimeProvider.js";
import { GoogleRealtimeProvider } from "./GoogleRealtimeProvider.js";
import { MistralRealtimeProvider } from "./MistralRealtimeProvider.js";
import { OpenAIRealtimeProvider } from "./OpenAIRealtimeProvider.js";

const mocks = vi.hoisted(() => ({
  buildGrantedRealtimeProxyUrl: vi.fn(),
  getModelConfigByModel: vi.fn(),
  resolveProviderApiKey: vi.fn(),
  sha256Hex: vi.fn(),
  generateId: vi.fn(),
}));

const runtime = createTestRuntime({
  models: { ...createCatalogueModelResolver(), getModelConfigByModel: mocks.getModelConfigByModel },
});

vi.mock("../../../credentials.js", () => ({
  resolveHostProviderApiKey: mocks.resolveProviderApiKey,
}));

vi.mock("../../../utils/googleStudio.js", () => ({
  formatGoogleStudioModelResource: (model: string) => `models/${model}`,
}));

vi.mock("@ngriffin_uk/polychat-utility-server/crypto", () => ({
  sha256Hex: mocks.sha256Hex,
}));

vi.mock("@ngriffin_uk/polychat-utility-server/id", () => ({
  generateId: mocks.generateId,
}));

vi.mock("./proxyUrl.js", () => ({
  buildGrantedRealtimeProxyUrl: mocks.buildGrantedRealtimeProxyUrl,
}));

const user: ProviderUser = {
  id: 42,
  email: "realtime@example.com",
  plan_id: "pro",
};

function createEnv(): ProviderEnv {
  return Object.assign(Object.create(null), {
    API_BASE_URL: "https://api.polychat.test",
  });
}

function createRequest(
  type: RealtimeSessionRequest["type"],
  overrides: Partial<Omit<RealtimeSessionRequest, "env" | "type" | "user">> = {},
): RealtimeSessionRequest {
  return {
    env: createEnv(),
    user,
    type,
    ...overrides,
  };
}

describe("realtime provider session contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveProviderApiKey.mockResolvedValue("provider-api-key");
    mocks.sha256Hex.mockResolvedValue("hashed-user-42");
    mocks.generateId.mockReturnValue("session-fixture-id");
    mocks.buildGrantedRealtimeProxyUrl.mockImplementation(
      async ({ apiBaseUrl, model, params, path, sessionId }) => {
        const url = new URL(path, apiBaseUrl);

        url.protocol = "wss:";
        for (const [key, value] of Object.entries(params ?? {})) {
          if (value) {
            url.searchParams.set(key, String(value));
          }
        }

        url.searchParams.set("grant", "grant-fixture");
        url.searchParams.set("model", model);
        url.searchParams.set("session_id", sessionId);

        return { expiresAt: 1_788_172_200, url: url.toString() };
      },
    );
    mocks.getModelConfigByModel.mockImplementation((model: string) => {
      const provider =
        model.startsWith("gpt-") || model === "openai-whisper"
          ? "openai"
          : model.startsWith("gemini-")
            ? "google-ai-studio"
            : model.startsWith("voxtral-")
              ? "mistral"
              : model.startsWith("scribe_")
                ? "elevenlabs"
                : "cartesia";

      return Promise.resolve({
        provider,
        matchingModel:
          model === "voxtral-mini-transcribe-realtime"
            ? "voxtral-mini-transcribe-realtime-2602"
            : model,
      });
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("creates an OpenAI WebRTC session from the client-secret response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        value: "ek_fixture",
        expires_at: 1_788_172_200,
        session: { id: "openai-session-fixture" },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAIRealtimeProvider(runtime);

    await expect(
      provider.createSession(
        createRequest("realtime", {
          instructions: "Answer concisely.",
          language: "en",
          voice: "marin",
        }),
      ),
    ).resolves.toEqual({
      id: "openai-session-fixture",
      provider: "openai",
      transport: "webrtc",
      url: "https://api.openai.com/v1/realtime/calls",
      client_secret: {
        value: "ek_fixture",
        expires_at: 1_788_172_200,
      },
      input_modalities: ["text", "audio"],
      output_modalities: ["audio"],
      modalities: ["audio"],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];

    expect(url).toBe("https://api.openai.com/v1/realtime/client_secrets");
    expect(init).toMatchObject({
      method: "POST",
      headers: {
        Authorization: "Bearer provider-api-key",
        "Content-Type": "application/json",
        "OpenAI-Safety-Identifier": "hashed-user-42",
      },
    });
    expect(JSON.parse(init.body)).toEqual({
      session: {
        type: "realtime",
        model: "gpt-realtime-2.1",
        output_modalities: ["audio"],
        instructions: "Answer concisely.",
        audio: {
          input: {
            format: { type: "audio/pcm", rate: 24000 },
            transcription: { model: "gpt-live-transcribe", language: "en" },
            turn_detection: {
              type: "semantic_vad",
              eagerness: "auto",
              create_response: true,
              interrupt_response: true,
            },
          },
          output: {
            format: { type: "audio/pcm", rate: 24000 },
            voice: "marin",
          },
        },
      },
    });
  });

  it("creates a constrained Gemini Live WebSocket session from an ephemeral token", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-31T09:00:00.000Z"));
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        name: "auth-token-fixture",
        expireTime: "2026-08-31T09:30:00.000Z",
        newSessionExpireTime: "2026-08-31T09:01:00.000Z",
      }),
    );

    vi.stubGlobal("fetch", fetchMock);
    const provider = new GoogleRealtimeProvider(runtime);

    const session = await provider.createSession(
      createRequest("realtime", {
        inputModalities: ["audio", "video"],
        instructions: "Describe only relevant visual changes.",
      }),
    );

    expect(session).toEqual({
      id: "auth-token-fixture",
      object: "realtime.session",
      type: "realtime",
      provider: "google-ai-studio",
      transport: "websocket",
      protocol: "gemini-live",
      model: "gemini-3.1-flash-live-preview",
      input_modalities: ["audio", "video"],
      output_modalities: ["audio"],
      modalities: ["audio"],
      audio: {
        input: { format: { type: "audio/pcm", rate: 16000 } },
        output: { format: { type: "audio/pcm", rate: 24000 }, voice: "Kore" },
      },
      client_secret: {
        value: "auth-token-fixture",
        expires_at: 1_788_168_600,
      },
      url: "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=auth-token-fixture",
      setup: {
        model: "models/gemini-3.1-flash-live-preview",
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
          },
        },
        realtimeInputConfig: {
          turnCoverage: "TURN_INCLUDES_AUDIO_ACTIVITY_AND_ALL_VIDEO",
        },
        systemInstruction: {
          parts: [{ text: "Describe only relevant visual changes." }],
        },
        sessionResumption: {},
        contextWindowCompression: { slidingWindow: {} },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      },
    });

    const [url, init] = fetchMock.mock.calls[0] ?? [];

    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/auth_tokens");
    expect(init.headers).toEqual({
      "x-goog-api-key": "provider-api-key",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(init.body)).toEqual({
      uses: 1,
      expireTime: "2026-08-31T11:00:00.000Z",
      newSessionExpireTime: "2026-08-31T09:01:00.000Z",
      liveConnectConstraints: {
        model: "models/gemini-3.1-flash-live-preview",
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
          },
          realtimeInputConfig: {
            turnCoverage: "TURN_INCLUDES_AUDIO_ACTIVITY_AND_ALL_VIDEO",
          },
          systemInstruction: {
            parts: [{ text: "Describe only relevant visual changes." }],
          },
          sessionResumption: {},
          contextWindowCompression: { slidingWindow: {} },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
      },
    });
  });

  it("describes a Mistral transcription proxy session with the resolved upstream model", async () => {
    const provider = new MistralRealtimeProvider(runtime);

    await expect(
      provider.createSession(
        createRequest("transcription", {
          delay: "medium",
        }),
      ),
    ).resolves.toEqual({
      id: "session-fixture-id",
      object: "realtime.transcription.session",
      type: "transcription",
      provider: "mistral",
      transport: "websocket",
      url: "wss://api.polychat.test/realtime/mistral/transcription?delay=medium&grant=grant-fixture&model=voxtral-mini-transcribe-realtime-2602&session_id=session-fixture-id",
      proxy_grant_expires_at: 1_788_172_200,
      audio_format: { encoding: "pcm_s16le", sample_rate: 16000 },
      input_audio_format: "pcm_s16le",
      input_audio_transcription: { model: "voxtral-mini-transcribe-realtime-2602" },
      target_streaming_delay_ms: 1000,
    });
  });

  it("describes an ElevenLabs transcription proxy session with language metadata", async () => {
    const provider = new ElevenLabsRealtimeProvider(runtime);

    await expect(
      provider.createSession(
        createRequest("transcription", {
          language: "fr",
        }),
      ),
    ).resolves.toEqual({
      id: "session-fixture-id",
      object: "realtime.transcription.session",
      type: "transcription",
      provider: "elevenlabs",
      transport: "websocket",
      url: "wss://api.polychat.test/realtime/elevenlabs/transcription?delay=minimal&language=fr&grant=grant-fixture&model=scribe_v2_realtime&session_id=session-fixture-id",
      proxy_grant_expires_at: 1_788_172_200,
      audio_format: { encoding: "pcm_s16le", sample_rate: 16000 },
      input_audio_format: "pcm_s16le",
      input_audio_transcription: { model: "scribe_v2_realtime", language_code: "fr" },
    });
  });

  it("describes a Cartesia transcription proxy session", async () => {
    const provider = new CartesiaRealtimeProvider(runtime);

    await expect(
      provider.createSession(
        createRequest("transcription", {
          language: "en",
        }),
      ),
    ).resolves.toEqual({
      id: "session-fixture-id",
      object: "realtime.transcription.session",
      type: "transcription",
      provider: "cartesia",
      transport: "websocket",
      url: "wss://api.polychat.test/realtime/cartesia/transcription?delay=low&grant=grant-fixture&model=ink-2&session_id=session-fixture-id",
      proxy_grant_expires_at: 1_788_172_200,
      audio_format: { encoding: "pcm_s16le", sample_rate: 16000 },
      input_audio_format: "pcm_s16le",
      input_audio_transcription: { model: "ink-2" },
    });
  });
});
