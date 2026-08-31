import type { Context } from "hono";

import { ResponseFactory } from "~/lib/http/ResponseFactory";
import { getRealtimeProvider } from "~/lib/providers/capabilities/realtime";
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

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

export function toCartesiaClientMessage(data: unknown): string | string[] | undefined {
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
  const transcript = getString(payload.transcript);
  const itemId = getString(payload.request_id);

  if (type === "turn.update" && transcript) {
    return JSON.stringify({
      type: "transcription.text",
      ...(itemId ? { item_id: itemId } : {}),
      text: transcript,
    });
  }

  if (type === "turn.end" && transcript) {
    return [
      JSON.stringify({
        type: "transcription.segment",
        ...(itemId ? { item_id: itemId } : {}),
        text: transcript,
      }),
      JSON.stringify({ type: "transcription.done", ...(itemId ? { item_id: itemId } : {}) }),
    ];
  }

  if (type === "connected") {
    return JSON.stringify({ type: "session.created" });
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
  language,
}: {
  context: Context;
  env: IEnv;
  user: IUser;
  model?: string;
  language?: string;
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
  const upstreamUrl = new URL("/stt/turns/websocket", "https://api.cartesia.ai");

  upstreamUrl.searchParams.set("model", modelToUse);
  upstreamUrl.searchParams.set("encoding", "pcm_s16le");
  upstreamUrl.searchParams.set("sample_rate", "16000");
  if (language) {
    upstreamUrl.searchParams.set("language", language);
  }

  return createRealtimeTranscriptionProxyResponse({
    context,
    providerLabel: "Cartesia",
    upstreamUrl,
    headers: {
      "X-API-Key": apiKey,
      "Cartesia-Version": "2026-03-01",
    },
    toUpstreamMessage: toCartesiaUpstreamMessage,
    toClientMessage: toCartesiaClientMessage,
  });
}
