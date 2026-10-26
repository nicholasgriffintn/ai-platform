import type { RealtimeLiveProviderDescriptor } from "@ngriffin_uk/polychat-schemas";

import { TranscriptionProxyRealtimeProvider } from "./TranscriptionProxyRealtimeProvider.js";

export const CARTESIA_REALTIME_DESCRIPTOR = {
  id: "cartesia",
  order: 4,
  label: "Cartesia Ink 2 Realtime",
  shortLabel: "Cartesia",
  liveMode: "composed",
  transport: "websocket",
  sessionType: "transcription",
  defaultDelay: "low",
  inputModalities: ["audio"],
  outputModalities: ["text"],
  description: "Ink 2 semantic turn detection and streaming speech-to-text",
  defaultModelId: "ink-2",
  composeWith: { reasoning: true, speech: true },
} satisfies RealtimeLiveProviderDescriptor;

export class CartesiaRealtimeProvider extends TranscriptionProxyRealtimeProvider {
  name = "cartesia";
  descriptor = CARTESIA_REALTIME_DESCRIPTOR;
  configuration = {
    acceptsUserApiKey: true,
    environmentVariables: ["CARTESIA_API_KEY"],
  };
  models = [CARTESIA_REALTIME_DESCRIPTOR.defaultModelId];
}
