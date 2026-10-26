import type { WebSocket as RealtimeUpstreamSocket } from "@cloudflare/workers-types";
import {
  type RealtimeTranscriptionDelay,
  getMistralTargetStreamingDelayMs,
  resolveMistralRealtimeProxyModel,
} from "@ngriffin_uk/polychat-ai-providers";
import type { Context } from "hono";

import { REALTIME_PROXY_LIMITS } from "~/config/realtime";
import { ResponseFactory } from "~/infrastructure/http/ResponseFactory";
import { getRealtimeProvider } from "~/infrastructure/providers/capabilities/realtime";
import { resolveRealtimeMaxSessionSeconds } from "~/modules/realtime/application/sessionLimits";
import { UserSettingsRepository } from "~/modules/user/infrastructure/UserSettingsRepository";
import type { IEnv, IUser } from "~/types";

import {
  buildMistralSessionUpdateMessage,
  isMistralSessionCreatedMessage,
  toMistralUpstreamMessage,
} from "./mistralProtocol";
import { resolveRealtimeProxyApiKey } from "./proxyTarget";
import {
  closeRealtimeSocket,
  connectRealtimeWebSocketUpstream,
  createRealtimeProxySessionEnd,
  openRealtimeProxySockets,
  normalizeClientRealtimeMessage,
  RealtimeProxyLimitError,
  RealtimeProxySessionLimits,
  serializeNormalizedClientRealtimeMessage,
  type RealtimeProxySessionEndHandler,
} from "./transcriptionProxy";

const MISTRAL_REALTIME_USER_AGENT = "polychat-mistral-realtime-proxy/1.0";

function bridgeMistralRealtimeSockets({
  client,
  upstream,
  sessionUpdateMessage,
  onSessionEnd,
  maxSessionDurationMs,
}: {
  client: WebSocket;
  upstream: RealtimeUpstreamSocket;
  sessionUpdateMessage: string;
  onSessionEnd?: RealtimeProxySessionEndHandler;
  maxSessionDurationMs?: number;
}): void {
  let hasSentSessionUpdate = false;
  const pendingClientMessages: string[] = [];
  const limits = new RealtimeProxySessionLimits();
  const endSession = createRealtimeProxySessionEnd(onSessionEnd, limits);
  const sessionTimer = setTimeout(() => {
    closeRealtimeSocket(client, 1008, "Realtime session duration limit reached");
    closeRealtimeSocket(upstream, 1008, "Realtime session duration limit reached");
    endSession();
  }, maxSessionDurationMs ?? REALTIME_PROXY_LIMITS.sessionDurationMs);
  const clearSessionTimer = () => clearTimeout(sessionTimer);

  const flushPendingClientMessages = () => {
    while (pendingClientMessages.length > 0 && upstream.readyState === WebSocket.OPEN) {
      const message = pendingClientMessages.shift();

      if (message) {
        limits.releasePendingFrame(message);
        upstream.send(message);
      }
    }
  };

  client.addEventListener("message", (event) => {
    try {
      const normalised = normalizeClientRealtimeMessage(event.data, limits);
      const message = toMistralUpstreamMessage(
        serializeNormalizedClientRealtimeMessage(normalised),
      );

      if (!hasSentSessionUpdate) {
        limits.addPendingFrame(message);
        pendingClientMessages.push(message);

        return;
      }

      upstream.send(message);
    } catch (error) {
      if (client.readyState !== WebSocket.OPEN) {
        return;
      }

      client.send(
        JSON.stringify({
          type: "error",
          error: {
            message: "Invalid realtime message",
            code: 400,
          },
        }),
      );
      const code = error instanceof RealtimeProxyLimitError ? error.closeCode : 1003;
      const reason =
        error instanceof RealtimeProxyLimitError ? error.message : "Invalid realtime message";

      closeRealtimeSocket(client, code, reason);
      closeRealtimeSocket(upstream, code, reason);
      endSession();
    }
  });

  upstream.addEventListener("message", (event) => {
    try {
      limits.assertUpstreamFrame(event.data);

      if (!hasSentSessionUpdate && isMistralSessionCreatedMessage(event.data)) {
        upstream.send(sessionUpdateMessage);
        hasSentSessionUpdate = true;
        flushPendingClientMessages();
      }

      if (client.readyState === WebSocket.OPEN) {
        client.send(event.data);
      }
    } catch (error) {
      const code = error instanceof RealtimeProxyLimitError ? error.closeCode : 1011;
      const reason =
        error instanceof RealtimeProxyLimitError ? error.message : "Invalid provider message";

      closeRealtimeSocket(client, code, reason);
      closeRealtimeSocket(upstream, code, reason);
      endSession();
    }
  });

  client.addEventListener("close", () => {
    clearSessionTimer();
    closeRealtimeSocket(upstream);
    endSession();
  });
  client.addEventListener("error", () => {
    clearSessionTimer();
    closeRealtimeSocket(upstream, 1011, "Client socket error");
    endSession();
  });
  upstream.addEventListener("close", (event) => {
    clearSessionTimer();
    closeRealtimeSocket(client, event.code, event.reason);
    endSession();
  });
  upstream.addEventListener("error", () => {
    clearSessionTimer();
    closeRealtimeSocket(client, 1011, "Upstream socket error");
    endSession();
  });
}

export async function createMistralRealtimeProxyResponse({
  context,
  delay,
  env,
  user,
  model,
  onSessionEnd,
  speakerLabels = false,
}: {
  context: Context;
  delay?: RealtimeTranscriptionDelay;
  speakerLabels?: boolean;
  env: IEnv;
  user: IUser;
  model?: string;
  onSessionEnd?: RealtimeProxySessionEndHandler;
}): Promise<Response> {
  const provider = getRealtimeProvider("mistral", context);
  const modelToUse = resolveMistralRealtimeProxyModel(model);

  if (!modelToUse) {
    return ResponseFactory.error(context, "Invalid model specified", 400);
  }

  const apiKey = await resolveRealtimeProxyApiKey(context, provider, { env, user });

  if (apiKey instanceof Response) {
    return apiKey;
  }

  const url = new URL("/v1/audio/transcriptions/realtime", "https://api.mistral.ai");

  url.searchParams.set("model", modelToUse);

  const sockets = await openRealtimeProxySockets({
    context,
    providerLabel: provider.descriptor.shortLabel,
    connectUpstream: connectRealtimeWebSocketUpstream(url, {
      Authorization: `Bearer ${apiKey}`,
      "user-agent": MISTRAL_REALTIME_USER_AGENT,
    }),
  });

  if (!sockets.ok) {
    return sockets.response;
  }

  const userSettings = await new UserSettingsRepository(env).getUserSettings(user.id);
  const audioFormat = provider.buildAudioFormat ? provider.buildAudioFormat() : undefined;
  const targetStreamingDelayMs = provider.getTranscriptionDelay
    ? getMistralTargetStreamingDelayMs(
        provider.getTranscriptionDelay({
          delay,
          env,
          user,
          type: "transcription",
        }),
      )
    : undefined;

  bridgeMistralRealtimeSockets({
    client: sockets.client,
    onSessionEnd,
    upstream: sockets.upstream,
    sessionUpdateMessage: buildMistralSessionUpdateMessage({
      audioFormat,
      speakerLabels,
      targetStreamingDelayMs,
      vocabulary: userSettings?.transcription_vocabulary ?? [],
    }),
    maxSessionDurationMs: resolveRealtimeMaxSessionSeconds(env) * 1000,
  });

  return sockets.response;
}
