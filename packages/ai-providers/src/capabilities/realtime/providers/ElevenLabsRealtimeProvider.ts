import type { RealtimeLiveProviderDescriptor } from "@ngriffin_uk/polychat-schemas";

import type { RealtimeSessionRequest, RealtimeTranscriptionDelay } from "../index.js";
import { TranscriptionProxyRealtimeProvider } from "./TranscriptionProxyRealtimeProvider.js";

export const ELEVENLABS_REALTIME_DESCRIPTOR = {
  id: "elevenlabs",
  order: 3,
  label: "ElevenLabs Scribe Realtime",
  shortLabel: "ElevenLabs",
  liveMode: "composed",
  transport: "websocket",
  sessionType: "transcription",
  defaultDelay: "minimal",
  inputModalities: ["audio"],
  outputModalities: ["text"],
  description: "Scribe realtime speech-to-text",
  defaultModelId: "scribe_v2_realtime",
  composeWith: { reasoning: true, speech: true },
} satisfies RealtimeLiveProviderDescriptor;

export class ElevenLabsRealtimeProvider extends TranscriptionProxyRealtimeProvider {
  name = "elevenlabs";
  descriptor = ELEVENLABS_REALTIME_DESCRIPTOR;
  configuration = {
    acceptsUserApiKey: true,
    environmentVariables: ["ELEVENLABS_API_KEY"],
  };
  models = [ELEVENLABS_REALTIME_DESCRIPTOR.defaultModelId];

  protected override buildProxyParams(
    request: RealtimeSessionRequest,
    delay: RealtimeTranscriptionDelay,
  ): Record<string, string | undefined> {
    return { delay, language: request.language };
  }

  protected override buildTranscriptionMetadata(
    request: RealtimeSessionRequest,
    model: string,
  ): Record<string, string> {
    return { model, ...(request.language ? { language_code: request.language } : {}) };
  }
}
