import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { generateId, readNonBlankString } from "@ngriffin_uk/polychat-utility-core";
import { base64ToBuffer } from "@ngriffin_uk/polychat-utility-server/base64";
import type { Context } from "hono";

import { getRealtimeProvider } from "~/infrastructure/providers/capabilities/realtime";
import { providerHost } from "~/infrastructure/providers/host";
import { resolveRealtimeMaxSessionSeconds } from "~/modules/realtime/application/sessionLimits";
import { recordProviderQuotaExhausted } from "~/modules/user/application/provider-quota";
import type { IEnv, IUser } from "~/types";

import { resolveRealtimeProxyApiKey } from "./proxyTarget";
import {
  connectRealtimeWebSocketUpstream,
  createRealtimeTranscriptionProxyResponse,
  type NormalizedClientRealtimeMessage,
  type RealtimeProxySessionEndHandler,
} from "./transcriptionProxy";

const logger = getLogger({ prefix: "modules/realtime/elevenlabs" });

const ELEVENLABS_SAMPLE_RATE = 16000;
const PCM_S16LE_BYTES_PER_SAMPLE = 2;
const MIN_COMMIT_AUDIO_MS = 300;
const MIN_COMMIT_AUDIO_BYTES =
  (ELEVENLABS_SAMPLE_RATE * PCM_S16LE_BYTES_PER_SAMPLE * MIN_COMMIT_AUDIO_MS) / 1000;

type ElevenLabsUpstreamMessageMapper = (message: NormalizedClientRealtimeMessage) => string | null;
type ElevenLabsClientMessageMapper = (message: unknown) => string | string[] | undefined;

const ELEVENLABS_ERROR_MESSAGE_TYPES = new Set([
  "auth_error",
  "quota_exceeded",
  "transcriber_error",
  "input_error",
  "invalid_request",
  "error",
  "commit_throttled",
  "unaccepted_terms",
  "rate_limited",
  "queue_overflow",
  "resource_exhausted",
  "session_time_limit_exceeded",
  "chunk_size_exceeded",
  "insufficient_audio_activity",
]);

function createInputAudioChunkMessage({
  audio,
  commit,
}: {
  audio?: string;
  commit: boolean;
}): string {
  return JSON.stringify({
    message_type: "input_audio_chunk",
    audio_base_64: audio ?? "",
    commit,
    sample_rate: ELEVENLABS_SAMPLE_RATE,
  });
}

export function createElevenLabsUpstreamMessageMapper(): ElevenLabsUpstreamMessageMapper {
  let uncommittedAudioBytes = 0;

  return (message) => {
    if (message.type === "input_audio.append") {
      uncommittedAudioBytes += base64ToBuffer(message.audio).byteLength;

      return createInputAudioChunkMessage({ audio: message.audio, commit: false });
    }

    if (message.type === "input_audio.flush" || message.type === "input_audio.end") {
      if (uncommittedAudioBytes < MIN_COMMIT_AUDIO_BYTES) {
        return null;
      }

      uncommittedAudioBytes = 0;

      return createInputAudioChunkMessage({ commit: true });
    }

    return null;
  };
}

function createSegmentId(): string {
  return `elevenlabs-${generateId()}`;
}

export function createElevenLabsClientMessageMapper(
  onQuotaExhausted?: () => void,
): ElevenLabsClientMessageMapper {
  let currentSegmentId = createSegmentId();
  let committedSegment: { itemId: string; text: string } | undefined;
  let quotaReported = false;

  const getActiveSegmentId = () => {
    if (committedSegment) {
      currentSegmentId = createSegmentId();
      committedSegment = undefined;
    }

    return currentSegmentId;
  };

  const getCommittedSegmentId = (text: string) => {
    if (committedSegment?.text === text) {
      return committedSegment.itemId;
    }

    if (committedSegment) {
      currentSegmentId = createSegmentId();
    }

    committedSegment = { itemId: currentSegmentId, text };

    return currentSegmentId;
  };

  return (data) => {
    if (typeof data !== "string") {
      return undefined;
    }

    let payload: Record<string, unknown>;

    try {
      payload = JSON.parse(data);
    } catch {
      return undefined;
    }

    const messageType = readNonBlankString(payload.message_type);
    const text = readNonBlankString(payload.text);

    if (messageType === "partial_transcript" && text) {
      return JSON.stringify({
        type: "transcription.text",
        item_id: getActiveSegmentId(),
        text,
      });
    }

    if (
      (messageType === "committed_transcript" ||
        messageType === "committed_transcript_with_timestamps") &&
      text
    ) {
      const itemId = getCommittedSegmentId(text);

      return [
        JSON.stringify({ type: "transcription.segment", item_id: itemId, text }),
        JSON.stringify({ type: "transcription.done", item_id: itemId }),
      ];
    }

    if (messageType === "session_started") {
      return JSON.stringify({ type: "session.created" });
    }

    if (messageType && ELEVENLABS_ERROR_MESSAGE_TYPES.has(messageType)) {
      if (messageType === "quota_exceeded" && !quotaReported) {
        quotaReported = true;
        onQuotaExhausted?.();
      }

      return JSON.stringify({
        type: "error",
        error: {
          message:
            readNonBlankString(payload.error) ?? readNonBlankString(payload.message) ?? messageType,
          code: messageType,
        },
      });
    }

    return data;
  };
}

export async function createElevenLabsRealtimeProxyResponse({
  context,
  env,
  user,
  model,
  language,
  onSessionEnd,
  waitUntil,
}: {
  context: Context;
  env: IEnv;
  user: IUser;
  model?: string;
  language?: string;
  onSessionEnd?: RealtimeProxySessionEndHandler;
  waitUntil: (work: Promise<unknown>) => void;
}): Promise<Response> {
  const provider = getRealtimeProvider("elevenlabs", { env, user });
  const apiKey = await resolveRealtimeProxyApiKey(context, provider, { env, user });

  if (apiKey instanceof Response) {
    return apiKey;
  }

  const modelToUse = model || provider.getDefaultModel("transcription");
  const upstreamUrl = new URL("/v1/speech-to-text/realtime", "https://api.elevenlabs.io");

  upstreamUrl.searchParams.set("model_id", modelToUse);
  upstreamUrl.searchParams.set("commit_strategy", "vad");
  if (language) {
    upstreamUrl.searchParams.set("language_code", language);
  }

  return createRealtimeTranscriptionProxyResponse({
    context,
    providerLabel: provider.descriptor.shortLabel,
    maxSessionDurationMs: resolveRealtimeMaxSessionSeconds(env) * 1000,
    connectUpstream: connectRealtimeWebSocketUpstream(upstreamUrl, { "xi-api-key": apiKey }),
    onSessionEnd,
    toUpstreamMessage: createElevenLabsUpstreamMessageMapper(),
    toClientMessage: createElevenLabsClientMessageMapper(() =>
      waitUntil(
        recordProviderQuotaExhausted(providerHost, env, {
          provider: "elevenlabs",
          userId: user.id,
        }).catch((error: unknown) =>
          logger.error("Failed to record ElevenLabs quota exhaustion", { error }),
        ),
      ),
    ),
  });
}
