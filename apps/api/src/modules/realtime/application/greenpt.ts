import type { RealtimeTranscriptionDelay } from "@ngriffin_uk/polychat-ai-providers";
import { isRecord, readNonBlankString } from "@ngriffin_uk/polychat-utility-core";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";
import type { Context } from "hono";

import { getRealtimeProvider } from "~/infrastructure/providers/capabilities/realtime";
import { resolveRealtimeMaxSessionSeconds } from "~/modules/realtime/application/sessionLimits";
import type { IEnv, IUser } from "~/types";

import { resolveRealtimeProxyApiKey, resolveRealtimeProxyModel } from "./proxyTarget";
import {
  base64AudioToBuffer,
  connectRealtimeWebSocketUpstream,
  createRealtimeTranscriptionProxyResponse,
  type NormalizedClientRealtimeMessage,
  type RealtimeProxySessionEndHandler,
} from "./transcriptionProxy";
import { buildRealtimeErrorMessage } from "./turnProtocol";

const GREENPT_LIVE_URL = "https://api.greenpt.ai/v1/listen";
const DEFAULT_LANGUAGE = "en";
const MULTILINGUAL_MODEL = "green-s-pro";
const MULTILINGUAL_LANGUAGE = "multi";

function resolveGreenPtLanguage(model: string, language?: string): string {
  if (language) {
    return language;
  }

  return model === MULTILINGUAL_MODEL ? MULTILINGUAL_LANGUAGE : DEFAULT_LANGUAGE;
}

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
  upstreamUrl.searchParams.set("language", resolveGreenPtLanguage(model, language));
  upstreamUrl.searchParams.set("punctuate", "true");
  upstreamUrl.searchParams.set("interim_results", delay === "xhigh" ? "false" : "true");

  return upstreamUrl;
}

export function toGreenPtClientMessage(data: unknown): string | undefined {
  if (typeof data !== "string") {
    return undefined;
  }

  const payload = safeParseJson<unknown>(data);

  if (!isRecord(payload)) {
    return undefined;
  }

  const type = readNonBlankString(payload.type);

  if (type === "Results") {
    const channel = isRecord(payload.channel) ? payload.channel : undefined;
    const alternatives = Array.isArray(channel?.alternatives) ? channel.alternatives : [];
    const firstAlternative = isRecord(alternatives[0]) ? alternatives[0] : undefined;
    const text = readNonBlankString(firstAlternative?.transcript);

    if (!text) {
      return undefined;
    }

    return JSON.stringify({
      type: payload.is_final === true ? "transcription.segment" : "transcription.text.delta",
      text,
    });
  }

  if (type === "Error") {
    return buildRealtimeErrorMessage(
      readNonBlankString(payload.description) ?? readNonBlankString(payload.message),
    );
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
  onSessionEnd?: RealtimeProxySessionEndHandler;
}): Promise<Response> {
  const provider = getRealtimeProvider("greenpt", { env, user });
  const apiKey = await resolveRealtimeProxyApiKey(context, provider, { env, user });

  if (apiKey instanceof Response) {
    return apiKey;
  }

  const modelToUse = resolveRealtimeProxyModel(context, provider, model);

  if (modelToUse instanceof Response) {
    return modelToUse;
  }

  return createRealtimeTranscriptionProxyResponse({
    context,
    providerLabel: provider.descriptor.shortLabel,
    maxSessionDurationMs: resolveRealtimeMaxSessionSeconds(env) * 1000,
    connectUpstream: connectRealtimeWebSocketUpstream(
      buildGreenPtRealtimeUpstreamUrl({ model: modelToUse, language, delay }),
      { Authorization: `Token ${apiKey}` },
    ),
    onSessionEnd,
    toUpstreamMessage: toGreenPtUpstreamMessage,
    toClientMessage: toGreenPtClientMessage,
  });
}
