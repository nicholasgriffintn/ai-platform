import type { RealtimeLiveProviderCatalogueItem } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import {
  createRealtimeLiveProviderOptions,
  getDefaultLiveModelId,
  getFirstReadyRealtimeLiveProviderOption,
  getRealtimeLiveProviderIdForModel,
  getRealtimeLiveProviderOption,
  supportsRealtimeLiveVideoInput,
  waitsForRealtimeLiveProviderFinalEventOnStop,
} from "./live-providers";

const providers: RealtimeLiveProviderCatalogueItem[] = [
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
    readiness: "setup_required",
    availabilityReason: "Configure an OpenAI API key in provider settings.",
  },
  {
    id: "google-ai-studio",
    order: 1,
    label: "Gemini Live",
    shortLabel: "Gemini",
    liveMode: "native",
    transport: "websocket",
    sessionType: "realtime",
    inputModalities: ["audio", "video"],
    outputModalities: ["audio"],
    description: "WebSocket voice and vision",
    defaultModelId: "gemini-3.1-flash-live-preview",
    supportsVideoInput: true,
    available: true,
    readiness: "ready",
    availabilityReason: "Gemini is ready.",
  },
];

describe("runtime realtime provider catalogue", () => {
  it("enriches backend descriptors with client protocol behaviour", () => {
    const options = createRealtimeLiveProviderOptions(providers);

    expect(options[1].websocket?.videoInput).toBeDefined();
    expect(supportsRealtimeLiveVideoInput("google-ai-studio", options)).toBe(true);
  });

  it("uses the requested provider even when setup is still required", () => {
    const options = createRealtimeLiveProviderOptions(providers);

    expect(getRealtimeLiveProviderOption("openai", options)).toMatchObject({
      id: "openai",
      readiness: "setup_required",
    });
    expect(getDefaultLiveModelId("openai", options)).toBe("gpt-realtime-2");
  });

  it("does not silently substitute a provider for an unknown id", () => {
    const options = createRealtimeLiveProviderOptions(providers);

    expect(getRealtimeLiveProviderOption("unknown", options)).toBeUndefined();
    expect(getDefaultLiveModelId("unknown", options)).toBeUndefined();
    expect(getFirstReadyRealtimeLiveProviderOption(options)?.id).toBe("google-ai-studio");
  });

  it("recognises realtime models only when their provider is in the runtime catalogue", () => {
    const options = createRealtimeLiveProviderOptions(providers);

    expect(
      getRealtimeLiveProviderIdForModel(
        { provider: "google-ai-studio", supportsRealtimeSession: true },
        options,
      ),
    ).toBe("google-ai-studio");
    expect(
      getRealtimeLiveProviderIdForModel(
        { provider: "mistral", supportsRealtimeSession: true },
        options,
      ),
    ).toBeUndefined();
  });

  it("downgrades websocket providers without a browser protocol adapter", () => {
    const [unsupported] = createRealtimeLiveProviderOptions(
      [{ ...providers[1], shortLabel: "Gemini" }],
      {},
    );

    expect(unsupported).toMatchObject({
      available: false,
      readiness: "unavailable",
      availabilityReason: "Gemini is not supported by this browser client.",
    });
  });

  it("defers message flushing for providers that finalize when the socket closes", () => {
    const [cartesia] = createRealtimeLiveProviderOptions([
      {
        ...providers[1],
        id: "cartesia",
        label: "Cartesia Ink 2 Realtime",
        shortLabel: "Cartesia",
        defaultModelId: "ink-2",
      },
    ]);

    expect(waitsForRealtimeLiveProviderFinalEventOnStop("cartesia", [cartesia])).toBe(true);
  });
});
