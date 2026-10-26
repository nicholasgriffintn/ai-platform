import type { RealtimeLiveProviderDescriptor } from "@ngriffin_uk/polychat-schemas";

import type { RealtimeSessionRequest, RealtimeTranscriptionDelay } from "../index.js";
import { TranscriptionProxyRealtimeProvider } from "./TranscriptionProxyRealtimeProvider.js";

export const MISTRAL_REALTIME_DESCRIPTOR = {
  id: "mistral",
  order: 2,
  label: "Mistral Realtime",
  shortLabel: "Mistral",
  liveMode: "composed",
  transport: "websocket",
  sessionType: "transcription",
  defaultDelay: "low",
  inputModalities: ["audio"],
  outputModalities: ["text"],
  description: "Streaming speech-to-text",
  defaultModelId: "voxtral-mini-transcribe-realtime",
  composeWith: { reasoning: true, speech: true },
} satisfies RealtimeLiveProviderDescriptor;

const DEFAULT_TRANSCRIPTION_MODEL = MISTRAL_REALTIME_DESCRIPTOR.defaultModelId;
const MISTRAL_REALTIME_MODEL_ID = "voxtral-mini-transcribe-realtime-3-0";
const MISTRAL_TARGET_DELAY_MS_BY_DELAY: Record<RealtimeTranscriptionDelay, number> = {
  minimal: 240,
  low: 480,
  medium: 800,
  high: 1200,
  xhigh: 2400,
};

export function getMistralTargetStreamingDelayMs(
  delay?: RealtimeTranscriptionDelay,
): number | undefined {
  return delay ? MISTRAL_TARGET_DELAY_MS_BY_DELAY[delay] : undefined;
}

export function resolveMistralRealtimeProxyModel(model?: string): string | undefined {
  const requestedModel = model ?? DEFAULT_TRANSCRIPTION_MODEL;

  if (
    requestedModel !== DEFAULT_TRANSCRIPTION_MODEL &&
    requestedModel !== MISTRAL_REALTIME_MODEL_ID
  ) {
    return undefined;
  }

  return MISTRAL_REALTIME_MODEL_ID;
}

export class MistralRealtimeProvider extends TranscriptionProxyRealtimeProvider {
  name = "mistral";
  descriptor = MISTRAL_REALTIME_DESCRIPTOR;
  configuration = {
    acceptsUserApiKey: true,
    environmentVariables: ["MISTRAL_API_KEY"],
  };
  models = [DEFAULT_TRANSCRIPTION_MODEL];

  protected override toUpstreamModel(): string {
    return MISTRAL_REALTIME_MODEL_ID;
  }

  protected override buildProxyParams(
    request: RealtimeSessionRequest,
  ): Record<string, string | undefined> {
    return { delay: request.delay, speakers: request.speakerLabels ? "true" : undefined };
  }

  protected override buildSessionExtras(request: RealtimeSessionRequest): Record<string, unknown> {
    const targetStreamingDelayMs = getMistralTargetStreamingDelayMs(
      this.getTranscriptionDelay(request),
    );

    return {
      audio: {
        input: { turn_detection: request.speakerLabels ? null : { type: "server" } },
      },
      ...(targetStreamingDelayMs ? { target_streaming_delay_ms: targetStreamingDelayMs } : {}),
    };
  }
}
