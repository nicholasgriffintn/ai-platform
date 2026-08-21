import { formatChatStreamSseDone, formatChatStreamSseEvent } from "@ngriffin_uk/polychat-schemas";

import type { SSEEventPayload } from "~/types";
import { getLogger } from "~/utils/logger";

const encoder = new TextEncoder();

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
  writeDone: () => Promise<void>;
  close: () => Promise<void>;
  abort: (error: unknown) => Promise<void>;
}

export function createChatSseStreamWriter(): ChatSseStreamWriter {
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();

  return {
    readable,
    writeEvent: (type: string, payload: SSEEventPayload = {}) =>
      writer.write(encodeEventData(createEventData(type, payload))),
    writeDone: () => writer.write(encodeEventData(formatChatStreamSseDone())),
    close: () => writer.close(),
    abort: (error: unknown) => writer.abort(error),
  };
}
