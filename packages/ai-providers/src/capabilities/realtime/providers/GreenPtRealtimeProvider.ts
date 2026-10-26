import type { RealtimeLiveProviderDescriptor } from "@ngriffin_uk/polychat-schemas";

import { GREENPT_API_KEY_ENV } from "../../../utils/greenpt.js";
import type { RealtimeSessionRequest, RealtimeTranscriptionDelay } from "../index.js";
import { TranscriptionProxyRealtimeProvider } from "./TranscriptionProxyRealtimeProvider.js";

export const GREENPT_REALTIME_DESCRIPTOR = {
  id: "greenpt",
  order: 5,
  label: "GreenPT Realtime",
  shortLabel: "GreenPT",
  liveMode: "composed",
  transport: "websocket",
  sessionType: "transcription",
  defaultDelay: "low",
  inputModalities: ["audio"],
  outputModalities: ["text"],
  description: "Green S streaming speech-to-text",
  defaultModelId: "green-s",
  composeWith: { reasoning: true, speech: true },
} satisfies RealtimeLiveProviderDescriptor;

export class GreenPtRealtimeProvider extends TranscriptionProxyRealtimeProvider {
  name = "greenpt";
  descriptor = GREENPT_REALTIME_DESCRIPTOR;
  configuration = {
    acceptsUserApiKey: true,
    environmentVariables: [GREENPT_API_KEY_ENV],
  };
  models = [GREENPT_REALTIME_DESCRIPTOR.defaultModelId, "green-s-pro"];

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
    return { model, ...(request.language ? { language: request.language } : {}) };
  }
}
