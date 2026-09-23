import { StreamingFormatter } from "@ngriffin_uk/polychat-ai-providers";
import { isRecord, parseServerSentEventBuffer } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { MAX_PROVIDER_STREAM_EVENT_LENGTH } from "~/config/limits";

function readStreamError(event: Record<string, unknown>): string | null {
  if (event.error) {
    return isRecord(event.error) && typeof event.error.message === "string"
      ? event.error.message
      : typeof event.error === "string"
        ? event.error
        : "The model returned an error";
  }

  if (
    event.type === "response.failed" &&
    isRecord(event.response) &&
    isRecord(event.response.error)
  ) {
    return typeof event.response.error.message === "string"
      ? event.response.error.message
      : "The model response failed";
  }

  return null;
}

export async function* readProviderTextStream(
  stream: ReadableStream,
  signal?: AbortSignal,
  onReasoning?: (reasoning: string) => void,
): AsyncGenerator<string, void, void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let pendingError: string | null = null;
  const deltas: string[] = [];
  const handleEvent = (event: Record<string, unknown>) => {
    const streamError = readStreamError(event);

    if (streamError) {
      pendingError = streamError;

      return;
    }

    const eventType = typeof event.type === "string" ? event.type : "";
    const reasoning = StreamingFormatter.extractThinkingFromChunk(event, eventType);

    if (typeof reasoning === "string" && reasoning) {
      onReasoning?.(reasoning);
    }

    const content = StreamingFormatter.extractContentFromChunk(event, eventType);

    if (typeof content === "string" && content) {
      deltas.push(content);
    }
  };

  try {
    while (true) {
      if (signal?.aborted) {
        await reader.cancel().catch(() => {});

        return;
      }

      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      if (buffer.length > MAX_PROVIDER_STREAM_EVENT_LENGTH) {
        throw new AssistantError(
          "Provider stream event exceeded the size limit",
          ErrorType.PROVIDER_ERROR,
        );
      }

      buffer = parseServerSentEventBuffer(buffer, { onEvent: handleEvent });

      if (pendingError) {
        throw new AssistantError(pendingError, ErrorType.PROVIDER_ERROR);
      }

      while (deltas.length > 0) {
        yield deltas.shift();
      }
    }

    buffer += decoder.decode();

    if (buffer.trim()) {
      parseServerSentEventBuffer(`${buffer}\n\n`, { onEvent: handleEvent });
    }

    if (pendingError) {
      throw new AssistantError(pendingError, ErrorType.PROVIDER_ERROR);
    }

    while (deltas.length > 0) {
      yield deltas.shift();
    }
  } finally {
    reader.releaseLock();
  }
}
