import type { SSEEventPayload } from "~/types";
import { getLogger } from "~/utils/logger";

const encoder = new TextEncoder();

const logger = getLogger({
  prefix: "CHAT:EMITTER",
});

/**
 * Creates a standardized SSE event data string
 * @param type - The type of event
 * @param payload - The payload of the event
 * @returns The formatted SSE event data string
 */
export function createEventData(
  type: string,
  payload: SSEEventPayload = {},
): string {
  let data;
  try {
    data = JSON.stringify({ ...payload, type });
  } catch (error) {
    logger.error("Error creating event data", { error, type, payload });
    throw error;
  }
  return `data: ${data}\n\n`;
}

/**
 * Encodes a string to Uint8Array using TextEncoder
 * @param data - The string to encode
 * @returns The encoded Uint8Array
 */
export function encodeEventData(data: string): Uint8Array {
  return encoder.encode(data);
}

/**
 * Helper to emit the [DONE] event to signal stream completion
 * @param controller - The stream controller
 */
export function emitDoneEvent(controller: TransformStreamDefaultController) {
  const doneEvent = encodeEventData("data: [DONE]\n\n");
  controller.enqueue(doneEvent);
}

/**
 * Helper to emit a standardized SSE event to the stream controller
 * @param controller - The stream controller
 * @param type - The type of event
 * @param payload - The payload of the event
 */
export function emitEvent(
  controller: TransformStreamDefaultController,
  type: string,
  payload: SSEEventPayload = {},
) {
  const eventData = createEventData(type, payload);
  const encodedEvent = encodeEventData(eventData);
  controller.enqueue(encodedEvent);
}
