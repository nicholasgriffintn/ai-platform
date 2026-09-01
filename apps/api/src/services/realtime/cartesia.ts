import type { Context } from "hono";

import { ResponseFactory } from "~/lib/http/ResponseFactory";
import {
  getRealtimeProvider,
  type RealtimeTranscriptionDelay,
} from "~/lib/providers/capabilities/realtime";
import { resolveRealtimeMaxSessionSeconds } from "~/lib/realtime/sessionLimits";
import type { IEnv, IUser } from "~/types";

import {
  base64AudioToBuffer,
  createRealtimeTranscriptionProxyResponse,
  type NormalizedClientRealtimeMessage,
} from "./transcriptionProxy";

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
const CARTESIA_TURN_END_TIMEOUT_MS_BY_DELAY: Record<RealtimeTranscriptionDelay, number> = {
  minimal: 640,
  low: 1600,
  medium: 3200,
  high: 5600,
  xhigh: 8000,
};

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
      String(CARTESIA_TURN_END_TIMEOUT_MS_BY_DELAY[delay]),
    );
  }

  return upstreamUrl;
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

export function toCartesiaClientMessage(data: unknown): string | undefined {
  if (typeof data !== "string") {
    return undefined;
  }

  let payload: Record<string, unknown>;

  try {
    payload = JSON.parse(data);
  } catch {
    return undefined;
  }

  const type = getString(payload.type);
  const text = getString(payload.text);

  if (type === "transcript" && text) {
    return JSON.stringify({
      type: payload.is_final === true ? "transcription.segment" : "transcription.text.delta",
      text,
    });
  }

  if (type === "flush_done" || type === "done") {
    return JSON.stringify({ type: "transcription.done" });
  }

  if (type === "error") {
    return JSON.stringify({ type: "error", error: { message: getString(payload.message) } });
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
  onSessionEnd?: () => void | Promise<void>;
}): Promise<Response> {
  const provider = getRealtimeProvider("cartesia", { env, user });
  const apiKey = await provider.getApiKey?.({
    env,
    user,
    type: "transcription",
  });

  if (!apiKey) {
    return ResponseFactory.error(context, "Failed to resolve API key for Cartesia provider", 500);
  }

  const modelToUse = model || provider.getDefaultModel("transcription");

  if (!provider.models?.includes(modelToUse)) {
    return ResponseFactory.error(context, "Invalid Cartesia realtime model", 400);
  }

  const upstreamUrl = buildCartesiaRealtimeUpstreamUrl({ delay, model: modelToUse });

  return createRealtimeTranscriptionProxyResponse({
    context,
    providerLabel: "Cartesia",
    maxSessionDurationMs: resolveRealtimeMaxSessionSeconds(env) * 1000,
    upstreamUrl,
    headers: {
      "X-API-Key": apiKey,
      "Cartesia-Version": CARTESIA_STT_API_VERSION,
    },
    onSessionEnd,
    toUpstreamMessage: toCartesiaUpstreamMessage,
    toClientMessage: toCartesiaClientMessage,
  });
}
