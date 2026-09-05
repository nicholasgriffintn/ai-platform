import { formatChatStreamSseDone, formatChatStreamSseEvent } from "@ngriffin_uk/polychat-schemas";

import type { SSEEventPayload } from "~/types";
import { getLogger } from "~/utils/logger";

const encoder = new TextEncoder();

const HEARTBEAT_INTERVAL_MS = 15_000;

const logger = getLogger({
  prefix: "CHAT:EMITTER",
});

export function createEventData(type: string, payload: SSEEventPayload = {}): string {
  try {
    return formatChatStreamSseEvent(type, payload);
  } catch (error) {
    logger.error("Error creating event data", { error, type, payload });
    throw error;
  }
}

export function encodeEventData(data: string): Uint8Array {
  return encoder.encode(data);
}

export interface ChatEventSink {
  writeEvent: (type: string, payload?: SSEEventPayload) => Promise<void>;
}

export const DISCARDING_EVENT_SINK: ChatEventSink = {
  writeEvent: async () => {},
};

export interface ChatSseStreamWriter extends ChatEventSink {
  readable: ReadableStream<Uint8Array>;
  isDetached: () => boolean;
  getContinuitySnapshot: () => ChatStreamContinuitySnapshot;
  writeComment: (text: string) => Promise<void>;
  writeDone: () => Promise<void>;
  close: () => Promise<void>;
  abort: (error: unknown) => Promise<void>;
}

export type ChatStreamDetachmentReason = "reader_closed" | "write_failed" | "settle_failed";

export interface ChatStreamContinuitySnapshot {
  detached: boolean;
  detachedAtMs?: number;
  detachmentReason?: ChatStreamDetachmentReason;
}

export function createChatSseStreamWriter(): ChatSseStreamWriter {
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  let detached = false;
  let detachedAtMs: number | undefined;
  let detachmentReason: ChatStreamDetachmentReason | undefined;

  const markDetached = (reason: ChatStreamDetachmentReason) => {
    if (detached) {
      return;
    }

    detached = true;
    detachedAtMs = Date.now();
    detachmentReason = reason;
  };

  writer.closed.catch(() => {
    markDetached("reader_closed");
  });

  const write = async (chunk: Uint8Array) => {
    if (detached) {
      return;
    }

    try {
      await writer.write(chunk);
    } catch {
      markDetached("write_failed");
    }
  };

  const settle = async (settleWriter: () => Promise<void>) => {
    if (detached) {
      return;
    }

    try {
      await settleWriter();
    } catch {
      markDetached("settle_failed");
    }
  };

  return {
    readable,
    isDetached: () => detached,
    getContinuitySnapshot: () => ({ detached, detachedAtMs, detachmentReason }),
    writeEvent: (type: string, payload: SSEEventPayload = {}) =>
      write(encodeEventData(createEventData(type, payload))),
    writeComment: (text: string) => write(encoder.encode(`: ${text}\n\n`)),
    writeDone: () => write(encodeEventData(formatChatStreamSseDone())),
    close: () => settle(() => writer.close()),
    abort: (error: unknown) => settle(() => writer.abort(error)),
  };
}

export function startChatStreamHeartbeat(stream: ChatSseStreamWriter): () => void {
  const timer = setInterval(() => {
    if (stream.isDetached()) {
      return;
    }

    void stream.writeComment("ping");
  }, HEARTBEAT_INTERVAL_MS);

  return () => clearInterval(timer);
}
