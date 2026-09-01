import { NO_STORE } from "@ngriffin_uk/polychat-schemas";
import type { Context } from "hono";

import { ResponseFactory } from "~/lib/http/ResponseFactory";
import {
  getRealtimeProvider,
  type RealtimeTranscriptionDelay,
} from "~/lib/providers/capabilities/realtime";
import {
  getMistralTargetStreamingDelayMs,
  resolveMistralRealtimeProxyModel,
} from "~/lib/providers/capabilities/realtime/providers";
import { resolveRealtimeMaxSessionSeconds } from "~/lib/realtime/sessionLimits";
import type { IEnv, IUser } from "~/types";

import { isMistralSessionCreatedMessage, toMistralUpstreamMessage } from "./mistralProtocol";
import {
  createRealtimeProxyHandshakeFailure,
  createRealtimeProxySessionEnd,
  normalizeClientRealtimeMessage,
  REALTIME_PROXY_LIMITS,
  RealtimeProxyLimitError,
  RealtimeProxySessionLimits,
  serializeNormalizedClientRealtimeMessage,
} from "./transcriptionProxy";

const MISTRAL_REALTIME_USER_AGENT = "polychat-mistral-realtime-proxy/1.0";

function closeSocket(socket: WebSocket, code = 1000, reason = ""): void {
  try {
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
      socket.close(code, reason);
    }
  } catch {
    // close can race with the peer closing first.
  }
}

function bridgeMistralRealtimeSockets({
  client,
  upstream,
  sessionUpdateMessage,
  onSessionEnd,
  maxSessionDurationMs,
}: {
  client: WebSocket;
  upstream: WebSocket;
  sessionUpdateMessage: string;
  onSessionEnd?: () => void | Promise<void>;
  maxSessionDurationMs?: number;
}): void {
  let hasSentSessionUpdate = false;
  const pendingClientMessages: string[] = [];
  const limits = new RealtimeProxySessionLimits();
  const endSession = createRealtimeProxySessionEnd(onSessionEnd);
  const sessionTimer = setTimeout(() => {
    closeSocket(client, 1008, "Realtime session duration limit reached");
    closeSocket(upstream, 1008, "Realtime session duration limit reached");
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

      closeSocket(client, code, reason);
      closeSocket(upstream, code, reason);
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

      closeSocket(client, code, reason);
      closeSocket(upstream, code, reason);
      endSession();
    }
  });

  client.addEventListener("close", () => {
    clearSessionTimer();
    closeSocket(upstream);
    endSession();
  });
  client.addEventListener("error", () => {
    clearSessionTimer();
    closeSocket(upstream, 1011, "Client socket error");
    endSession();
  });
  upstream.addEventListener("close", (event) => {
    clearSessionTimer();
    closeSocket(client, event.code, event.reason);
    endSession();
  });
  upstream.addEventListener("error", () => {
    clearSessionTimer();
    closeSocket(client, 1011, "Upstream socket error");
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
}: {
  context: Context;
  delay?: RealtimeTranscriptionDelay;
  env: IEnv;
  user: IUser;
  model?: string;
  onSessionEnd?: () => void | Promise<void>;
}): Promise<Response> {
  const request = context.req.raw;
  const isWebSocketUpgrade = request.headers.get("Upgrade")?.toLowerCase() === "websocket";

  if (!isWebSocketUpgrade) {
    return new Response("Expected WebSocket upgrade", {
      status: 426,
      headers: { Upgrade: "websocket", "Cache-Control": NO_STORE },
    });
  }

  const provider = getRealtimeProvider("mistral", context);
  const modelToUse = resolveMistralRealtimeProxyModel(model);

  if (!modelToUse) {
    return ResponseFactory.error(context, "Invalid model specified", 400);
  }

  const apiKey = await provider.getApiKey?.({
    env,
    user,
    type: "transcription",
  });

  if (!apiKey) {
    return ResponseFactory.error(context, "Failed to resolve API key for Mistral provider", 500);
  }

  const url = new URL("/v1/audio/transcriptions/realtime", "https://api.mistral.ai");

  url.searchParams.set("model", modelToUse);

  const upstreamResponse = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Upgrade: "websocket",
      "user-agent": MISTRAL_REALTIME_USER_AGENT,
    },
  });

  if (upstreamResponse.status !== 101 || !upstreamResponse.webSocket) {
    return createRealtimeProxyHandshakeFailure(context, "Mistral", upstreamResponse);
  }

  const pair = new WebSocketPair();
  const [clientSocket, serverSocket] = Object.values(pair);

  serverSocket.accept();
  upstreamResponse.webSocket.accept();

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
    client: serverSocket,
    onSessionEnd,
    upstream: upstreamResponse.webSocket,
    sessionUpdateMessage: JSON.stringify({
      type: "session.update",
      session: {
        audio_format: audioFormat,
        ...(targetStreamingDelayMs ? { target_streaming_delay_ms: targetStreamingDelayMs } : {}),
      },
    }),
    maxSessionDurationMs: resolveRealtimeMaxSessionSeconds(env) * 1000,
  });

  return new Response(null, {
    status: 101,
    webSocket: clientSocket,
    headers: {
      "Cache-Control": NO_STORE,
    },
  });
}
