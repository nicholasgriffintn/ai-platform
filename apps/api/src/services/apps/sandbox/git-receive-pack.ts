import { AssistantError, ErrorType } from "~/utils/errors";

const MAX_COMMAND_PREFIX_BYTES = 64 * 1024;
const FLUSH_PACKET_LENGTH = 4;
const encoder = new TextDecoder();

interface ReceivePackInspection {
  body: ReadableStream<Uint8Array<ArrayBuffer>>;
  refs: string[];
}

function combineChunks(
  chunks: Uint8Array<ArrayBuffer>[],
  totalBytes: number,
): Uint8Array<ArrayBuffer> {
  const combined = new Uint8Array(totalBytes);
  let offset = 0;

  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return combined;
}

function parseCommandRefs(bytes: Uint8Array<ArrayBuffer>): string[] | null {
  const refs: string[] = [];
  let offset = 0;

  while (offset + FLUSH_PACKET_LENGTH <= bytes.byteLength) {
    const lengthText = encoder.decode(bytes.subarray(offset, offset + FLUSH_PACKET_LENGTH));

    if (lengthText === "0000") {
      return refs;
    }

    if (!/^[0-9a-fA-F]{4}$/.test(lengthText)) {
      throw new AssistantError("Invalid Git receive-pack request", ErrorType.PARAMS_ERROR, 400);
    }

    const packetLength = Number.parseInt(lengthText, 16);

    if (packetLength < FLUSH_PACKET_LENGTH) {
      throw new AssistantError("Invalid Git receive-pack packet", ErrorType.PARAMS_ERROR, 400);
    }

    if (offset + packetLength > bytes.byteLength) {
      return null;
    }

    const payload = encoder
      .decode(bytes.subarray(offset + FLUSH_PACKET_LENGTH, offset + packetLength))
      .split("\0", 1)[0]
      ?.trim();
    const command = payload?.match(
      /^([0-9a-f]{40,64}) ([0-9a-f]{40,64}) (refs\/heads\/[A-Za-z0-9._/-]+)$/i,
    );

    if (!command?.[2] || !command[3] || /^0+$/.test(command[2])) {
      throw new AssistantError("Unsupported Git receive-pack command", ErrorType.PARAMS_ERROR, 400);
    }

    refs.push(command[3]);
    offset += packetLength;
  }

  return null;
}

function rebuildBody(
  reader: ReadableStreamDefaultReader<Uint8Array<ArrayBuffer>>,
  bufferedChunks: Uint8Array<ArrayBuffer>[],
): ReadableStream<Uint8Array<ArrayBuffer>> {
  let bufferedIndex = 0;

  return new ReadableStream<Uint8Array<ArrayBuffer>>({
    pull: async (controller) => {
      if (bufferedIndex < bufferedChunks.length) {
        controller.enqueue(bufferedChunks[bufferedIndex]);
        bufferedIndex += 1;

        return;
      }

      const next = await reader.read();

      if (next.done) {
        reader.releaseLock();
        controller.close();

        return;
      }

      controller.enqueue(next.value);
    },
    cancel: async (reason) => {
      await reader.cancel(reason);
    },
  });
}

export async function inspectGitReceivePackBody(
  body: ReadableStream<Uint8Array<ArrayBuffer>> | null,
): Promise<ReceivePackInspection> {
  if (!body) {
    throw new AssistantError("Git receive-pack body is required", ErrorType.PARAMS_ERROR, 400);
  }

  const reader = body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let totalBytes = 0;

  while (totalBytes <= MAX_COMMAND_PREFIX_BYTES) {
    const next = await reader.read();

    if (next.done) {
      break;
    }

    chunks.push(next.value);
    totalBytes += next.value.byteLength;

    const refs = parseCommandRefs(combineChunks(chunks, totalBytes));

    if (refs) {
      return { body: rebuildBody(reader, chunks), refs };
    }
  }

  await reader.cancel();
  throw new AssistantError(
    "Git receive-pack command prefix is invalid or too large",
    ErrorType.PARAMS_ERROR,
    400,
  );
}
