import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  createResponseEventStamper,
  formatResponseStreamSseDone,
  formatResponseStreamSseEvent,
  type ResponseEventInput,
  type ResponseStreamEvent,
} from "@ngriffin_uk/polychat-schemas";

const encoder = new TextEncoder();

const HEARTBEAT_INTERVAL_MS = 15_000;

const logger = getLogger({
  prefix: "CHAT:EMITTER",
});

export interface ChatEventSink {
  write: (event: ResponseEventInput) => Promise<void>;
}

export const DISCARDING_EVENT_SINK: ChatEventSink = {
  write: async () => {},
};

export interface ChatSseStreamWriterOptions {
  conversationId?: string;
  responseId?: string;
}

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

export function encodeResponseStreamEvent(event: ResponseStreamEvent): Uint8Array {
  return encoder.encode(formatResponseStreamSseEvent(event));
}

export function createChatSseStreamWriter(
  options: ChatSseStreamWriterOptions = {},
): ChatSseStreamWriter {
  let detached = false;
  let settled = false;
  let detachedAtMs: number | undefined;
  let detachmentReason: ChatStreamDetachmentReason | undefined;
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
  const stamper = createResponseEventStamper({
    conversationId: options.conversationId,
    responseId: options.responseId,
  });

  const markDetached = (reason: ChatStreamDetachmentReason) => {
    if (detached) {
      return;
    }

    detached = true;
    detachedAtMs = Date.now();
    detachmentReason = reason;
  };

  const readable = new ReadableStream<Uint8Array>({
    start(nextController) {
      controller = nextController;
    },
    cancel() {
      markDetached("reader_closed");
      controller = undefined;
    },
  });

  const write = async (chunk: Uint8Array) => {
    if (detached || settled) {
      return;
    }

    try {
      controller?.enqueue(chunk);
    } catch {
      markDetached("write_failed");
      controller = undefined;
    }
  };

  const settle = async (settleStream: () => void) => {
    if (detached || settled) {
      return;
    }

    try {
      settleStream();
      settled = true;
      controller = undefined;
    } catch {
      markDetached("settle_failed");
      controller = undefined;
    }
  };

  return {
    readable,
    isDetached: () => detached,
    getContinuitySnapshot: () => ({ detached, detachedAtMs, detachmentReason }),
    write: async (event: ResponseEventInput) => {
      let stamped: ResponseStreamEvent;

      try {
        stamped = stamper.stamp(event);
      } catch (error) {
        logger.error("Error stamping stream event", { error, type: event.type });
        throw error;
      }

      await write(encodeResponseStreamEvent(stamped));
    },
    writeComment: (text: string) => write(encoder.encode(`: ${text}\n\n`)),
    writeDone: () => write(encoder.encode(formatResponseStreamSseDone())),
    close: () => settle(() => controller?.close()),
    abort: (error: unknown) => settle(() => controller?.error(error)),
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
