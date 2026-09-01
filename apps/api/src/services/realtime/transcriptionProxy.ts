import { NO_STORE } from "@ngriffin_uk/polychat-schemas";
import type { Context } from "hono";

import { ResponseFactory } from "~/lib/http/ResponseFactory";
import { base64ToBuffer, bufferToBase64 } from "~/utils/base64";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "services/realtime/transcription-proxy" });
const CLIENT_MESSAGE_TYPES = new Set([
  "input_audio.append",
  "input_audio.flush",
  "input_audio.end",
]);
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export const REALTIME_PROXY_LIMITS = {
  clientFrameBytes: 384 * 1024,
  audioFrameBytes: 256 * 1024,
  pendingFrames: 32,
  pendingBytes: 2 * 1024 * 1024,
  sessionAudioBytes: 25 * 1024 * 1024,
  sessionDurationMs: 15 * 60 * 1000,
  upstreamFrameBytes: 2 * 1024 * 1024,
  mappedFramesPerEvent: 32,
  controlMessages: 128,
} as const;

export class RealtimeProxyLimitError extends Error {
  constructor(
    message: string,
    readonly closeCode: 1008 | 1009,
  ) {
    super(message);
    this.name = "RealtimeProxyLimitError";
  }
}

function dataByteLength(data: unknown): number {
  if (typeof data === "string") {
    return new TextEncoder().encode(data).byteLength;
  }

  if (data instanceof ArrayBuffer) {
    return data.byteLength;
  }

  return Number.POSITIVE_INFINITY;
}

function decodedBase64ByteLength(value: string): number {
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;

  return (value.length / 4) * 3 - padding;
}

export class RealtimeProxySessionLimits {
  private pendingBytes = 0;
  private pendingFrames = 0;
  private sessionAudioBytes = 0;
  private controlMessages = 0;

  assertClientFrame(data: unknown): void {
    if (dataByteLength(data) > REALTIME_PROXY_LIMITS.clientFrameBytes) {
      throw new RealtimeProxyLimitError("Realtime frame is too large", 1009);
    }
  }

  recordAudioFrame(byteLength: number): void {
    if (byteLength <= 0 || byteLength > REALTIME_PROXY_LIMITS.audioFrameBytes) {
      throw new RealtimeProxyLimitError("Realtime audio frame is too large", 1009);
    }

    this.sessionAudioBytes += byteLength;

    if (this.sessionAudioBytes > REALTIME_PROXY_LIMITS.sessionAudioBytes) {
      throw new RealtimeProxyLimitError("Realtime session audio limit reached", 1008);
    }
  }

  addPendingFrame(frame: string): void {
    const byteLength = dataByteLength(frame);

    if (
      this.pendingFrames + 1 > REALTIME_PROXY_LIMITS.pendingFrames ||
      this.pendingBytes + byteLength > REALTIME_PROXY_LIMITS.pendingBytes
    ) {
      throw new RealtimeProxyLimitError("Realtime pending queue limit reached", 1008);
    }

    this.pendingFrames += 1;
    this.pendingBytes += byteLength;
  }

  releasePendingFrame(frame: string): void {
    this.pendingFrames = Math.max(0, this.pendingFrames - 1);
    this.pendingBytes = Math.max(0, this.pendingBytes - dataByteLength(frame));
  }

  assertUpstreamFrame(data: unknown): void {
    if (dataByteLength(data) > REALTIME_PROXY_LIMITS.upstreamFrameBytes) {
      throw new RealtimeProxyLimitError("Realtime provider frame is too large", 1009);
    }
  }

  assertMappedFrames(messages: readonly string[]): void {
    if (messages.length > REALTIME_PROXY_LIMITS.mappedFramesPerEvent) {
      throw new RealtimeProxyLimitError("Realtime provider emitted too many frames", 1008);
    }

    for (const message of messages) {
      this.assertUpstreamFrame(message);
    }
  }

  recordControlMessage(): void {
    this.controlMessages += 1;

    if (this.controlMessages > REALTIME_PROXY_LIMITS.controlMessages) {
      throw new RealtimeProxyLimitError("Realtime control message limit reached", 1008);
    }
  }
}

export interface RealtimeTranscriptionProxyOptions {
  context: Context;
  providerLabel: string;
  upstreamUrl: URL;
  headers: Record<string, string>;
  toUpstreamMessage: (message: NormalizedClientRealtimeMessage) => string | ArrayBuffer | null;
  toClientMessage: (message: unknown) => string | string[] | undefined;
  onSessionEnd?: () => void | Promise<void>;
  maxSessionDurationMs?: number;
}

export type NormalizedClientRealtimeMessage =
  | { type: "input_audio.append"; audio: string }
  | { type: "input_audio.flush" }
  | { type: "input_audio.end" };

export function createRealtimeProxySessionEnd(
  onSessionEnd?: () => void | Promise<void>,
): () => void {
  let hasEnded = false;

  return () => {
    if (hasEnded) {
      return;
    }

    hasEnded = true;
    void Promise.resolve(onSessionEnd?.()).catch(() => {
      logger.error("Realtime proxy reservation release failed");
    });
  };
}

function closeSocket(socket: WebSocket, code = 1000, reason = ""): void {
  try {
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
      socket.close(code, reason);
    }
  } catch {
    // close can race with the peer closing first.
  }
}

function parseJson(data: unknown): unknown {
  if (typeof data !== "string") {
    return undefined;
  }

  try {
    return JSON.parse(data);
  } catch {
    return undefined;
  }
}

export function normalizeClientRealtimeMessage(
  data: unknown,
  limits = new RealtimeProxySessionLimits(),
): NormalizedClientRealtimeMessage {
  limits.assertClientFrame(data);

  if (data instanceof ArrayBuffer) {
    limits.recordAudioFrame(data.byteLength);

    return {
      type: "input_audio.append",
      audio: bufferToBase64(data),
    };
  }

  const payload = parseJson(data);

  if (!payload || typeof payload !== "object") {
    throw new AssistantError("Invalid realtime message", ErrorType.PARAMS_ERROR);
  }

  const message = payload as Record<string, unknown>;
  const type = message.type;

  if (typeof type !== "string" || !CLIENT_MESSAGE_TYPES.has(type)) {
    throw new AssistantError("Unsupported realtime message type", ErrorType.PARAMS_ERROR);
  }

  if (type === "input_audio.flush") {
    limits.recordControlMessage();

    return { type: "input_audio.flush" };
  }

  if (type === "input_audio.end") {
    limits.recordControlMessage();

    return { type: "input_audio.end" };
  }

  const audio = message.audio;

  if (typeof audio !== "string" || !BASE64_PATTERN.test(audio)) {
    throw new AssistantError("Invalid realtime audio payload", ErrorType.PARAMS_ERROR);
  }

  limits.recordAudioFrame(decodedBase64ByteLength(audio));

  return { type: "input_audio.append", audio };
}

export function serializeNormalizedClientRealtimeMessage(
  message: NormalizedClientRealtimeMessage,
): string {
  return JSON.stringify(message);
}

function getProxyFailureStatus(providerStatus: number): 400 | 401 | 403 | 404 | 429 | 502 {
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

export function createRealtimeProxyHandshakeFailure(
  context: Context,
  providerLabel: string,
  upstreamResponse: Response,
): Response {
  const hasCorrelationId = Boolean(
    upstreamResponse.headers.get("mistral-correlation-id") ??
    upstreamResponse.headers.get("x-kong-request-id") ??
    upstreamResponse.headers.get("x-request-id"),
  );

  logger.error(`${providerLabel} realtime handshake failed`, {
    hasCorrelationId,
    providerStatus: upstreamResponse.status,
    providerStatusText: upstreamResponse.statusText,
  });

  return ResponseFactory.error(
    context,
    `${providerLabel} realtime connection failed`,
    getProxyFailureStatus(upstreamResponse.status),
  );
}

function sendClientError(client: WebSocket): void {
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
}

export function bridgeRealtimeTranscriptionSockets({
  client,
  onSessionEnd,
  upstream,
  toUpstreamMessage,
  toClientMessage,
  maxSessionDurationMs,
}: {
  client: WebSocket;
  upstream: WebSocket;
  toUpstreamMessage: RealtimeTranscriptionProxyOptions["toUpstreamMessage"];
  toClientMessage: RealtimeTranscriptionProxyOptions["toClientMessage"];
  onSessionEnd?: RealtimeTranscriptionProxyOptions["onSessionEnd"];
  maxSessionDurationMs?: number;
}): void {
  const limits = new RealtimeProxySessionLimits();
  const endSession = createRealtimeProxySessionEnd(onSessionEnd);
  const sessionTimer = setTimeout(() => {
    closeSocket(client, 1008, "Realtime session duration limit reached");
    closeSocket(upstream, 1008, "Realtime session duration limit reached");
    endSession();
  }, maxSessionDurationMs ?? REALTIME_PROXY_LIMITS.sessionDurationMs);
  const clearSessionTimer = () => clearTimeout(sessionTimer);

  client.addEventListener("message", (event) => {
    try {
      const message = normalizeClientRealtimeMessage(event.data, limits);
      const upstreamMessage = toUpstreamMessage(message);

      if (upstreamMessage !== null && upstream.readyState === WebSocket.OPEN) {
        upstream.send(upstreamMessage);
      }
    } catch (error) {
      sendClientError(client);
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

      if (client.readyState !== WebSocket.OPEN) {
        return;
      }

      const clientMessage = toClientMessage(event.data);

      if (Array.isArray(clientMessage)) {
        limits.assertMappedFrames(clientMessage);

        for (const message of clientMessage) {
          client.send(message);
        }
      } else if (clientMessage) {
        limits.assertMappedFrames([clientMessage]);
        client.send(clientMessage);
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

export function base64AudioToBuffer(base64Audio: string): ArrayBuffer {
  const bytes = base64ToBuffer(base64Audio);
  const buffer = new ArrayBuffer(bytes.byteLength);

  new Uint8Array(buffer).set(bytes);

  return buffer;
}

export async function createRealtimeTranscriptionProxyResponse({
  context,
  headers,
  onSessionEnd,
  providerLabel,
  toClientMessage,
  toUpstreamMessage,
  upstreamUrl,
  maxSessionDurationMs,
}: RealtimeTranscriptionProxyOptions): Promise<Response> {
  const request = context.req.raw;
  const isWebSocketUpgrade = request.headers.get("Upgrade")?.toLowerCase() === "websocket";

  if (!isWebSocketUpgrade) {
    return new Response("Expected WebSocket upgrade", {
      status: 426,
      headers: { Upgrade: "websocket", "Cache-Control": NO_STORE },
    });
  }

  const upstreamResponse = await fetch(upstreamUrl, {
    headers: {
      ...headers,
      Upgrade: "websocket",
    },
  });

  if (upstreamResponse.status !== 101 || !upstreamResponse.webSocket) {
    return createRealtimeProxyHandshakeFailure(context, providerLabel, upstreamResponse);
  }

  const pair = new WebSocketPair();
  const [clientSocket, serverSocket] = Object.values(pair);

  serverSocket.accept();
  upstreamResponse.webSocket.accept();

  bridgeRealtimeTranscriptionSockets({
    client: serverSocket,
    onSessionEnd,
    upstream: upstreamResponse.webSocket,
    toClientMessage,
    toUpstreamMessage,
    maxSessionDurationMs,
  });

  return new Response(null, {
    status: 101,
    webSocket: clientSocket,
    headers: {
      "Cache-Control": NO_STORE,
    },
  });
}
