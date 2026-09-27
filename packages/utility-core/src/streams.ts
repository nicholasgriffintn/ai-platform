import { concatBytes } from "./binary.js";

export async function* readTextLines(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<string, void, undefined> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let completed = false;

  try {
    while (true) {
      const { value, done } = await reader.read();

      if (done) {
        completed = true;
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      let newline = buffer.indexOf("\n");

      while (newline !== -1) {
        yield buffer.slice(0, newline).replace(/\r$/, "");
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf("\n");
      }
    }

    buffer += decoder.decode();

    if (buffer.length > 0) {
      yield buffer.replace(/\r$/, "");
    }
  } finally {
    if (!completed) {
      await reader.cancel().catch(() => undefined);
    }

    reader.releaseLock();
  }
}

export function mapJsonLines(
  stream: ReadableStream<Uint8Array>,
  map: (record: unknown) => unknown,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const lines = readTextLines(stream);

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      while (true) {
        const next = await lines.next();

        if (next.done) {
          controller.close();

          return;
        }

        if (next.value.trim() === "") {
          continue;
        }

        const mapped = map(JSON.parse(next.value));

        if (mapped !== undefined) {
          controller.enqueue(encoder.encode(`${JSON.stringify(mapped)}\n`));

          return;
        }
      }
    },
    async cancel() {
      await lines.return();
    },
  });
}

export async function readStreamBytes(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();

  while (true) {
    const { value, done } = await reader.read();

    if (done) {
      break;
    }

    chunks.push(value);
  }

  return concatBytes(chunks);
}
