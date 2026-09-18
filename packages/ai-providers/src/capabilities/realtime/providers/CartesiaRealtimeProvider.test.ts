import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestRuntime } from "../../../__test__/test-runtime.js";
import type { ProviderEnv, ProviderUser } from "../../../env.js";
import { createCatalogueModelResolver } from "../../../model-resolver.js";
import type { RealtimeSessionRequest } from "../index.js";
import {
  CARTESIA_REALTIME_DESCRIPTOR,
  CartesiaRealtimeProvider,
} from "./CartesiaRealtimeProvider.js";

const getModelConfigByModelMock = vi.hoisted(() => vi.fn());
const buildGrantedRealtimeProxyUrlMock = vi.hoisted(() => vi.fn());

const runtime = createTestRuntime({
  models: { ...createCatalogueModelResolver(), getModelConfigByModel: getModelConfigByModelMock },
});

vi.mock("../../../credentials.js", () => ({
  resolveHostProviderApiKey: vi.fn(async () => "test-api-key"),
}));

vi.mock("./proxyUrl.js", () => ({
  buildGrantedRealtimeProxyUrl: buildGrantedRealtimeProxyUrlMock,
}));

const testUser: ProviderUser = {
  id: 42,
  email: "test@example.com",
  plan_id: "pro",
};

function createRequest(overrides: Partial<RealtimeSessionRequest> = {}): RealtimeSessionRequest {
  return {
    apiBaseUrl: "https://api.polychat.test",
    env: Object.assign(Object.create(null), {}) as ProviderEnv,
    user: testUser,
    type: "transcription",
    ...overrides,
  };
}

describe("CartesiaRealtimeProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getModelConfigByModelMock.mockResolvedValue({
      provider: "cartesia",
      matchingModel: "ink-2",
    });
    buildGrantedRealtimeProxyUrlMock.mockResolvedValue({
      expiresAt: 1_788_134_400,
      url: "wss://api.polychat.test/realtime/cartesia/transcription?model=ink-2&delay=minimal&session_id=session-1&grant=grant-1",
    });
  });

  it("exposes Ink 2 as the only supported realtime transcription model", () => {
    const provider = new CartesiaRealtimeProvider(runtime);

    expect(CARTESIA_REALTIME_DESCRIPTOR.defaultModelId).toBe("ink-2");
    expect(provider.getDefaultModel("transcription")).toBe("ink-2");
    expect(provider.models).toEqual(["ink-2"]);
  });

  it("creates a proxy session for Ink 2 with the selected turn delay", async () => {
    const provider = new CartesiaRealtimeProvider(runtime);

    await expect(
      provider.createSession(createRequest({ delay: "minimal" })),
    ).resolves.toMatchObject({
      provider: "cartesia",
      transport: "websocket",
      url: "wss://api.polychat.test/realtime/cartesia/transcription?model=ink-2&delay=minimal&session_id=session-1&grant=grant-1",
      proxy_grant_expires_at: 1_788_134_400,
      audio_format: { encoding: "pcm_s16le", sample_rate: 16000 },
      input_audio_transcription: { model: "ink-2" },
    });
    expect(buildGrantedRealtimeProxyUrlMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "ink-2",
        params: { delay: "minimal" },
        provider: "cartesia",
        userId: testUser.id,
      }),
    );
  });

  it("rejects the retired Ink Whisper model", async () => {
    const provider = new CartesiaRealtimeProvider(runtime);

    await expect(provider.createSession(createRequest({ model: "ink-whisper" }))).rejects.toThrow(
      "Invalid model specified",
    );
    expect(getModelConfigByModelMock).not.toHaveBeenCalled();
  });
});
