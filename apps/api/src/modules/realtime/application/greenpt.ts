import type { RealtimeTranscriptionDelay } from "@ngriffin_uk/polychat-ai-providers";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";
import type { Context } from "hono";

import { ResponseFactory } from "~/infrastructure/http/ResponseFactory";
import { getRealtimeProvider } from "~/infrastructure/providers/capabilities/realtime";
import { resolveRealtimeMaxSessionSeconds } from "~/modules/realtime/application/sessionLimits";
import type { IEnv, IUser } from "~/types";

import {
  base64AudioToBuffer,
  createRealtimeTranscriptionProxyResponse,
  type NormalizedClientRealtimeMessage,
} from "./transcriptionProxy";

const GREENPT_LIVE_URL = "wss://api.greenpt.ai/v1/listen";
const DEFAULT_LANGUAGE = "en";

export function toGreenPtUpstreamMessage(
  message: NormalizedClientRealtimeMessage,
): string | ArrayBuffer | null {
  if (message.type === "input_audio.flush") {
    return null;
  }

  if (message.type === "input_audio.end") {
    return JSON.stringify({ type: "CloseStream" });
  }

  return base64AudioToBuffer(message.audio);
}

export function buildGreenPtRealtimeUpstreamUrl({
  model,
  language,
  delay,
}: {
  model: string;
  language?: string;
  delay?: RealtimeTranscriptionDelay;
}): URL {
  const upstreamUrl = new URL(GREENPT_LIVE_URL);

  upstreamUrl.searchParams.set("model", model);
  upstreamUrl.searchParams.set("encoding", "linear16");
  upstreamUrl.searchParams.set("sample_rate", "16000");
  upstreamUrl.searchParams.set("language", language ?? DEFAULT_LANGUAGE);
  upstreamUrl.searchParams.set("punctuate", "true");
  upstreamUrl.searchParams.set("interim_results", delay === "xhigh" ? "false" : "true");

  return upstreamUrl;
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

export function toGreenPtClientMessage(data: unknown): string | undefined {
  if (typeof data !== "string") {
    return undefined;
  }

  const payload = safeParseJson<Record<string, unknown>>(data);

  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  const type = getString(payload.type);

  if (type === "Results") {
    const channel = payload.channel as
      | { alternatives?: Array<{ transcript?: unknown }> }
      | undefined;
    const text = getString(channel?.alternatives?.[0]?.transcript);

    if (!text) {
      return undefined;
    }

    return JSON.stringify({
      type: payload.is_final === true ? "transcription.segment" : "transcription.text.delta",
      text,
    });
  }

  if (type === "Error") {
    return JSON.stringify({
      type: "error",
      error: { message: getString(payload.description) ?? getString(payload.message) },
    });
  }

  if (type === "Metadata" || type === "SpeechStarted" || type === "UtteranceEnd") {
    return undefined;
  }

  return data;
}

export async function createGreenPtRealtimeProxyResponse({
  context,
  env,
  user,
  model,
  language,
  delay,
  onSessionEnd,
}: {
  context: Context;
  env: IEnv;
  user: IUser;
  model?: string;
  language?: string;
  delay?: RealtimeTranscriptionDelay;
  onSessionEnd?: () => void | Promise<void>;
}): Promise<Response> {
  const provider = getRealtimeProvider("greenpt", { env, user });
  const apiKey = await provider.getApiKey?.({
    env,
    user,
    type: "transcription",
  });

  if (!apiKey) {
    return ResponseFactory.error(context, "Failed to resolve API key for GreenPT provider", 500);
  }

  const modelToUse = model || provider.getDefaultModel("transcription");

  if (!provider.models?.includes(modelToUse)) {
    return ResponseFactory.error(context, "Invalid GreenPT realtime model", 400);
  }

  const upstreamUrl = buildGreenPtRealtimeUpstreamUrl({ model: modelToUse, language, delay });

  return createRealtimeTranscriptionProxyResponse({
    context,
    providerLabel: "GreenPT",
    maxSessionDurationMs: resolveRealtimeMaxSessionSeconds(env) * 1000,
    upstreamUrl,
    headers: {
      Authorization: `Token ${apiKey}`,
    },
    onSessionEnd,
    toUpstreamMessage: toGreenPtUpstreamMessage,
    toClientMessage: toGreenPtClientMessage,
  });
}
