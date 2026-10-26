import type { RealtimeTranscriptionDelay } from "@ngriffin_uk/polychat-ai-providers";
import { isRecord, readNonBlankString } from "@ngriffin_uk/polychat-utility-core";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";
import type { Context } from "hono";

import { getRealtimeProvider } from "~/infrastructure/providers/capabilities/realtime";
import { resolveRealtimeMaxSessionSeconds } from "~/modules/realtime/application/sessionLimits";
import type { IEnv, IUser } from "~/types";

import { resolveRealtimeProxyModel } from "./proxyTarget";
import {
  base64AudioToBuffer,
  createRealtimeTranscriptionProxyResponse,
  type NormalizedClientRealtimeMessage,
  type RealtimeProxySessionEndHandler,
} from "./transcriptionProxy";
import {
  buildRealtimeErrorMessage,
  buildRealtimeTurnMessage,
  REALTIME_TURN_END_TIMEOUT_MS_BY_DELAY,
  type RealtimeTurnEvent,
} from "./turnProtocol";

const WORKERS_AI_FLUX_MODEL = "@cf/deepgram/flux";
const FLUX_TURN_EVENTS: Record<string, RealtimeTurnEvent> = {
  StartOfTurn: "start",
  Update: "update",
  EagerEndOfTurn: "eager_end",
  TurnResumed: "resume",
  EndOfTurn: "end",
};

export function toWorkersAiFluxUpstreamMessage(
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

function readFrameText(data: unknown): string | undefined {
  if (typeof data === "string") {
    return data;
  }

  if (data instanceof ArrayBuffer) {
    return new TextDecoder().decode(data);
  }

  return undefined;
}

export function toWorkersAiFluxClientMessage(data: unknown): string | undefined {
  const text = readFrameText(data);
  const payload = text ? safeParseJson<unknown>(text) : undefined;

  if (!isRecord(payload)) {
    return undefined;
  }

  if (readNonBlankString(payload.type)?.toLowerCase() === "error") {
    return buildRealtimeErrorMessage(
      readNonBlankString(payload.description) ?? readNonBlankString(payload.message),
      readNonBlankString(payload.code),
    );
  }

  const event = readNonBlankString(payload.event);
  const turnEvent = event ? FLUX_TURN_EVENTS[event] : undefined;
  const transcript = readNonBlankString(payload.transcript);

  if (!turnEvent || (turnEvent === "update" && !transcript)) {
    return undefined;
  }

  return buildRealtimeTurnMessage(turnEvent, transcript);
}

export function buildWorkersAiFluxInputs(
  delay?: RealtimeTranscriptionDelay,
): Ai_Cf_Deepgram_Flux_Input {
  return {
    encoding: "linear16",
    sample_rate: "16000",
    ...(delay ? { eot_timeout_ms: String(REALTIME_TURN_END_TIMEOUT_MS_BY_DELAY[delay]) } : {}),
  };
}

export async function createWorkersAiRealtimeProxyResponse({
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
  const provider = getRealtimeProvider("workers-ai", { env, user });
  const modelToUse = resolveRealtimeProxyModel(context, provider, model);

  if (modelToUse instanceof Response) {
    return modelToUse;
  }

  return createRealtimeTranscriptionProxyResponse({
    context,
    providerLabel: provider.descriptor.shortLabel,
    maxSessionDurationMs: resolveRealtimeMaxSessionSeconds(env) * 1000,
    connectUpstream: () =>
      env.AI.run(WORKERS_AI_FLUX_MODEL, buildWorkersAiFluxInputs(delay), { websocket: true }),
    onSessionEnd,
    toUpstreamMessage: toWorkersAiFluxUpstreamMessage,
    toClientMessage: toWorkersAiFluxClientMessage,
  });
}
