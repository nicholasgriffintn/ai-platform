const encoder = new TextEncoder();

export function encodeServerSentEvent(value: unknown): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(value)}\n\n`);
}

export function encodeServerSentEventComment(value: string): Uint8Array {
  return encoder.encode(`: ${value}\n\n`);
}

export function encodeServerSentEventDone(): Uint8Array {
  return encoder.encode("data: [DONE]\n\n");
}

export interface ServerSentEventParserOptions<T> {
  onEvent: (event: T) => void;
  onError?: (error: Error) => void;
}

export function parseServerSentEventBuffer<T = Record<string, unknown>>(
  buffer: string,
  options: ServerSentEventParserOptions<T>,
): string {
  const blocks = buffer.split(/\r?\n\r?\n/);
  const remainingBuffer = blocks.pop() || "";

  for (const block of blocks) {
    const dataLines = block
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart());

    if (dataLines.length === 0) {
      continue;
    }

    const payload = dataLines.join("\n").trim();

    if (!payload || payload === "[DONE]") {
      continue;
    }

    try {
      options.onEvent(JSON.parse(payload) as T);
    } catch (error) {
      options.onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }

  return remainingBuffer;
}

export async function readServerSentEvents<T = Record<string, unknown>>(
  body: ReadableStream<Uint8Array>,
  options: ServerSentEventParserOptions<T>,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer = parseServerSentEventBuffer(
        buffer + decoder.decode(value, { stream: true }),
        options,
      );
    }

    buffer += decoder.decode();

    if (buffer.trim()) {
      parseServerSentEventBuffer(`${buffer}\n\n`, options);
    }
  } finally {
    reader.releaseLock();
  }
}
