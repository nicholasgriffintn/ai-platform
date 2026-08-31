import { bufferToBase64 } from "~/utils/base64";
import { AssistantError, ErrorType } from "~/utils/errors";

const MISTRAL_CLIENT_MESSAGE_TYPES = new Set([
  "input_audio.append",
  "input_audio.flush",
  "input_audio.end",
]);
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

function sanitiseClientMessage(data: string): string {
  let payload: unknown;

  try {
    payload = JSON.parse(data);
  } catch {
    throw new AssistantError("Invalid realtime message", ErrorType.PARAMS_ERROR);
  }

  if (!payload || typeof payload !== "object") {
    throw new AssistantError("Invalid realtime message", ErrorType.PARAMS_ERROR);
  }

  const message = payload as Record<string, unknown>;
  const type = message.type;

  if (typeof type !== "string" || !MISTRAL_CLIENT_MESSAGE_TYPES.has(type)) {
    throw new AssistantError("Unsupported realtime message type", ErrorType.PARAMS_ERROR);
  }

  if (type !== "input_audio.append") {
    return JSON.stringify({ type });
  }

  const audio = message.audio;

  if (typeof audio !== "string" || !BASE64_PATTERN.test(audio)) {
    throw new AssistantError("Invalid realtime audio payload", ErrorType.PARAMS_ERROR);
  }

  return JSON.stringify({ type, audio });
}

export function isMistralSessionCreatedMessage(data: unknown): boolean {
  if (typeof data !== "string") {
    return false;
  }

  try {
    const payload = JSON.parse(data) as { type?: unknown };

    return payload.type === "session.created";
  } catch {
    return false;
  }
}

export function toMistralUpstreamMessage(data: unknown): string {
  if (typeof data === "string") {
    return sanitiseClientMessage(data);
  }

  if (data instanceof ArrayBuffer) {
    return JSON.stringify({
      type: "input_audio.append",
      audio: bufferToBase64(data),
    });
  }

  throw new TypeError("Unsupported realtime message payload");
}
