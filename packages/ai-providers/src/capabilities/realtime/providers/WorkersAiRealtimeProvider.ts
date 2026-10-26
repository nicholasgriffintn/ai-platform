import type { RealtimeLiveProviderDescriptor } from "@ngriffin_uk/polychat-schemas";

import { TranscriptionProxyRealtimeProvider } from "./TranscriptionProxyRealtimeProvider.js";

export const WORKERS_AI_REALTIME_DESCRIPTOR = {
  id: "workers-ai",
  order: 6,
  label: "Workers AI Flux",
  shortLabel: "Workers AI",
  liveMode: "composed",
  transport: "websocket",
  sessionType: "transcription",
  defaultDelay: "low",
  inputModalities: ["audio"],
  outputModalities: ["text"],
  description: "Deepgram Flux turn-aware speech-to-text on Cloudflare",
  defaultModelId: "@cf/deepgram/flux",
  composeWith: { reasoning: true, speech: true },
} satisfies RealtimeLiveProviderDescriptor;

export class WorkersAiRealtimeProvider extends TranscriptionProxyRealtimeProvider {
  name = "workers-ai";
  descriptor = WORKERS_AI_REALTIME_DESCRIPTOR;
  configuration = {
    acceptsUserApiKey: false,
    environmentVariables: [],
    bindings: ["AI"],
  };
  models = [WORKERS_AI_REALTIME_DESCRIPTOR.defaultModelId];
}
