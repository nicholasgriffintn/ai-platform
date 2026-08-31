import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildRealtimeSessionPath,
  createRealtimeSession,
  fetchRealtimeLiveProviders,
} from "./realtime-service";

describe("realtime-service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("builds provider-specific realtime session paths", () => {
    const path = buildRealtimeSessionPath({
      type: "realtime",
      provider: "google-ai-studio",
      model: "gemini-3.1-flash-live-preview",
      transport: "websocket",
      inputModalities: ["audio", "video"],
      outputModalities: ["audio"],
      voice: "Puck",
      instructions: "Be concise.",
    });

    expect(path).toBe(
      "/realtime/session/realtime?provider=google-ai-studio&model=gemini-3.1-flash-live-preview&transport=websocket&voice=Puck&instructions=Be+concise.&input_modalities=audio%2Cvideo&output_modalities=audio",
    );
  });

  it("creates realtime sessions through the API wrapper", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      Response.json({
        id: "authTokens/live-token",
        transport: "websocket",
        protocol: "gemini-live",
        url: "wss://generativelanguage.googleapis.com/ws/live",
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const session = await createRealtimeSession({
      type: "realtime",
      provider: "google-ai-studio",
      transport: "websocket",
      inputModalities: ["audio", "video"],
      outputModalities: ["audio"],
      timeoutMs: null,
    });

    expect(session).toMatchObject({
      id: "authTokens/live-token",
      transport: "websocket",
      protocol: "gemini-live",
    });
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "/realtime/session/realtime?provider=google-ai-studio&transport=websocket&input_modalities=audio%2Cvideo&output_modalities=audio",
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "POST",
      credentials: "include",
    });
  });

  it("fetches the runtime realtime provider catalogue", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      Response.json({
        providers: [
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
        ],
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchRealtimeLiveProviders()).resolves.toMatchObject({
      providers: [{ id: "openai", readiness: "ready" }],
    });
    expect(String(fetchMock.mock.calls[0][0])).toContain("/realtime/providers");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ credentials: "include" });
  });
});
