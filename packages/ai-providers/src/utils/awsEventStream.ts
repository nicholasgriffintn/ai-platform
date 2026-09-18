import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";

const logger = getLogger({ prefix: "utils/awsEventStream" });

export function createEventStreamParser(): TransformStream {
  let buffer = new Uint8Array();
  let isEventStreamFormat: boolean | null = null;

  return new TransformStream({
    transform(chunk: Uint8Array, controller) {
      if (isEventStreamFormat === null) {
        const asText = new TextDecoder("utf-8", { fatal: false }).decode(chunk);

        if (asText.includes("data:") || asText.includes("event:")) {
          isEventStreamFormat = false;
        } else if (chunk.length >= 4) {
          const possibleLength = new DataView(chunk.buffer, chunk.byteOffset).getUint32(0, false);

          if (possibleLength > 0 && possibleLength < 1000000) {
            isEventStreamFormat = true;
          } else {
            isEventStreamFormat = false;
          }
        }
      }

      if (isEventStreamFormat === false) {
        controller.enqueue(chunk);

        return;
      }

      const newBuffer = new Uint8Array(buffer.length + chunk.length);

      newBuffer.set(buffer);
      newBuffer.set(chunk, buffer.length);
      buffer = newBuffer;

      while (buffer.length >= 12) {
        try {
          const totalLength = new DataView(buffer.buffer, buffer.byteOffset).getUint32(0, false);
          const headersLength = new DataView(buffer.buffer, buffer.byteOffset).getUint32(4, false);
          const _preludeCrc = new DataView(buffer.buffer, buffer.byteOffset).getUint32(8, false);

          if (buffer.length < totalLength) {
            break;
          }

          const payloadStart = 12 + headersLength;
          const payloadEnd = totalLength - 4;
          const payloadBytes = buffer.slice(payloadStart, payloadEnd);

          try {
            const payloadString = new TextDecoder().decode(payloadBytes);
            const eventData = safeParseJson(payloadString);

            const sseEvent = `data: ${JSON.stringify(eventData)}\n\n`;

            controller.enqueue(new TextEncoder().encode(sseEvent));
          } catch (decodeError: any) {
            logger.error("Could not decode bedrock payload as JSON", {
              payloadLength: payloadBytes.length,
              payloadString: new TextDecoder("utf-8", { fatal: false }).decode(payloadBytes),
              error: decodeError.message,
            });
          }

          buffer = buffer.slice(totalLength);
        } catch (parseError: any) {
          logger.error("Failed to parse message header", {
            error: parseError.message,
            bufferLength: buffer.length,
            firstBytes: Array.from(buffer.slice(0, 16))
              .map((b) => `0x${b.toString(16).padStart(2, "0")}`)
              .join(" "),
          });
          buffer = buffer.slice(1);
        }
      }
    },

    flush(controller) {
      controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
    },
  });
}
