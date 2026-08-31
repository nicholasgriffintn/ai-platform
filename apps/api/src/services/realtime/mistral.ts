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
import { formatProviderError } from "~/lib/providers/utils/errors";
import type { IEnv, IUser } from "~/types";
import { getLogger } from "~/utils/logger";

import { isMistralSessionCreatedMessage, toMistralUpstreamMessage } from "./mistralProtocol";

const logger = getLogger({ prefix: "services/realtime/mistral" });
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

function getMistralProxyFailureStatus(providerStatus: number): 400 | 401 | 403 | 404 | 429 | 502 {
  switch (providerStatus) {
    case 400:
    case 401:
    case 403:
    case 404:
    case 429:
      return providerStatus;
    default:
      return 502;
  }
}

function bridgeMistralRealtimeSockets({
  client,
  upstream,
  sessionUpdateMessage,
}: {
  client: WebSocket;
  upstream: WebSocket;
  sessionUpdateMessage: string;
}): void {
  let hasSentSessionUpdate = false;
  const pendingClientMessages: string[] = [];

  const flushPendingClientMessages = () => {
    while (pendingClientMessages.length > 0 && upstream.readyState === WebSocket.OPEN) {
      upstream.send(pendingClientMessages.shift());
    }
  };

  client.addEventListener("message", (event) => {
    try {
      const message = toMistralUpstreamMessage(event.data);

      if (!hasSentSessionUpdate) {
        const MISTRAL_PENDING_MESSAGE_LIMIT = 64;

        if (pendingClientMessages.length >= MISTRAL_PENDING_MESSAGE_LIMIT) {
          throw new Error("Upstream session is not ready");
        }

        pendingClientMessages.push(message);

        return;
      }

      upstream.send(message);
    } catch {
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
      closeSocket(client, 1003, "Invalid realtime message");
      closeSocket(upstream, 1003, "Invalid realtime message");
    }
  });

  upstream.addEventListener("message", (event) => {
    if (!hasSentSessionUpdate && isMistralSessionCreatedMessage(event.data)) {
      upstream.send(sessionUpdateMessage);
      hasSentSessionUpdate = true;
      flushPendingClientMessages();
    }

    if (client.readyState === WebSocket.OPEN) {
      client.send(event.data);
    }
  });

  client.addEventListener("close", () => closeSocket(upstream));
  client.addEventListener("error", () => closeSocket(upstream, 1011, "Client socket error"));
  upstream.addEventListener("close", (event) => closeSocket(client, event.code, event.reason));
  upstream.addEventListener("error", () => closeSocket(client, 1011, "Upstream socket error"));
}

export async function createMistralRealtimeProxyResponse({
  context,
  delay,
  env,
  user,
  model,
}: {
  context: Context;
  delay?: RealtimeTranscriptionDelay;
  env: IEnv;
  user: IUser;
  model?: string;
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
    const providerError = await formatProviderError(
      upstreamResponse,
      "Failed to connect to Mistral realtime",
    );
    const status = getMistralProxyFailureStatus(upstreamResponse.status);
    const correlationId =
      upstreamResponse.headers.get("mistral-correlation-id") ??
      upstreamResponse.headers.get("x-kong-request-id");

    logger.error("Mistral realtime handshake failed", {
      model: modelToUse,
      providerStatus: upstreamResponse.status,
      providerStatusText: upstreamResponse.statusText,
      providerResponse: providerError,
      providerCorrelationId: correlationId,
    });
    const details = [providerError, correlationId ? `correlation_id=${correlationId}` : ""]
      .filter(Boolean)
      .join(" - ");

    return ResponseFactory.error(context, details, status);
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
    upstream: upstreamResponse.webSocket,
    sessionUpdateMessage: JSON.stringify({
      type: "session.update",
      session: {
        audio_format: audioFormat,
        ...(targetStreamingDelayMs ? { target_streaming_delay_ms: targetStreamingDelayMs } : {}),
      },
    }),
  });

  return new Response(null, {
    status: 101,
    webSocket: clientSocket,
    headers: {
      "Cache-Control": NO_STORE,
    },
  });
}
