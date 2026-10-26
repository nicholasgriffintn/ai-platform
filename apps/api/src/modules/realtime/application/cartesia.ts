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
import { buildRealtimeErrorMessage, REALTIME_TURN_END_TIMEOUT_MS_BY_DELAY } from "./turnProtocol";

export function toCartesiaUpstreamMessage(
  message: NormalizedClientRealtimeMessage,
): string | ArrayBuffer | null {
  if (message.type === "input_audio.flush") {
    return null;
  }

  if (message.type === "input_audio.end") {
    return JSON.stringify({ type: "close" });
  }

  return base64AudioToBuffer(message.audio);
}

export const CARTESIA_STT_API_VERSION = "2026-08-14";

export function buildCartesiaRealtimeUpstreamUrl({
  delay,
  model,
}: {
  delay?: RealtimeTranscriptionDelay;
  model: string;
}): URL {
  const upstreamUrl = new URL("/stt/turns/websocket", "https://api.cartesia.ai");

  upstreamUrl.searchParams.set("model", model);
  upstreamUrl.searchParams.set("encoding", "pcm_s16le");
  upstreamUrl.searchParams.set("sample_rate", "16000");
  upstreamUrl.searchParams.set("cartesia_version", CARTESIA_STT_API_VERSION);

  if (delay) {
    upstreamUrl.searchParams.set(
      "turn_end_timeout_ms",
      String(REALTIME_TURN_END_TIMEOUT_MS_BY_DELAY[delay]),
    );
  }

  return upstreamUrl;
}

export function toCartesiaClientMessage(data: unknown): string | undefined {
  if (typeof data !== "string") {
    return undefined;
  }

  const payload = safeParseJson<unknown>(data);

  if (!isRecord(payload)) {
    return undefined;
  }

  const type = readNonBlankString(payload.type);

  if (type === "error") {
    return buildRealtimeErrorMessage(
      readNonBlankString(payload.message) ?? readNonBlankString(payload.title),
      readNonBlankString(payload.error_code) ?? payload.status_code,
    );
  }

  return data;
}

export async function createCartesiaRealtimeProxyResponse({
  context,
  env,
  user,
  model,
  delay,
  onSessionEnd,
}: {
  context: Context;
  env: IEnv;
  user: IUser;
  model?: string;
  delay?: RealtimeTranscriptionDelay;
  onSessionEnd?: RealtimeProxySessionEndHandler;
}): Promise<Response> {
  const provider = getRealtimeProvider("cartesia", { env, user });
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
      buildCartesiaRealtimeUpstreamUrl({ delay, model: modelToUse }),
      { "X-API-Key": apiKey },
    ),
    onSessionEnd,
    toUpstreamMessage: toCartesiaUpstreamMessage,
    toClientMessage: toCartesiaClientMessage,
  });
}
