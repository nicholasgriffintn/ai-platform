import {
  assertJsonComplexity,
  isRecord,
  parseServerSentEventBuffer,
} from "@ngriffin_uk/polychat-utility-core";
import { readResponseChunksWithinLimit } from "@ngriffin_uk/polychat-utility-server/http";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";

import { McpProtocolError } from "./errors.js";

const MAX_RESPONSE_BYTES = 512 * 1024;

function readRpcResult(message: unknown, id: string): Record<string, unknown> | undefined {
  if (!isRecord(message) || message.jsonrpc !== "2.0") {
    throw new McpProtocolError("invalid_response");
  }

  if (typeof message.method === "string") {
    if (message.id !== undefined) {
      throw new McpProtocolError("unsupported_input");
    }

    return undefined;
  }

  if (message.id !== id || ("error" in message && "result" in message)) {
    throw new McpProtocolError("invalid_response");
  }

  if ("error" in message) {
    throw new McpProtocolError(
      isRecord(message.error) && message.error.code === -32022
        ? "unsupported_protocol"
        : "request_failed",
    );
  }

  if (!isRecord(message.result)) {
    throw new McpProtocolError("invalid_response");
  }

  if (message.result.resultType === "input_required" || "inputRequests" in message.result) {
    throw new McpProtocolError("unsupported_input");
  }

  if (message.result.resultType !== "complete") {
    throw new McpProtocolError("invalid_response");
  }

  assertJsonComplexity(message.result, 32, 16384);

  return message.result;
}

export async function readMcpResponse(
  response: Response,
  id: string,
  signal: AbortSignal,
): Promise<Record<string, unknown>> {
  const mediaType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();

  if (mediaType !== "application/json" && mediaType !== "text/event-stream") {
    await response.body?.cancel();
    throw new McpProtocolError("invalid_response");
  }

  const decoder = new TextDecoder("utf-8", { fatal: true });
  let buffer = "";
  let result: Record<string, unknown> | undefined;

  for await (const chunk of readResponseChunksWithinLimit(response, MAX_RESPONSE_BYTES, signal)) {
    buffer += decoder.decode(chunk, { stream: true });

    if (mediaType === "text/event-stream") {
      buffer = parseServerSentEventBuffer<unknown>(buffer, {
        onEvent(message) {
          const next = readRpcResult(message, id);

          if (next && result) {
            throw new McpProtocolError("invalid_response");
          }

          result ??= next;
        },
        onError(error) {
          throw error;
        },
      });

      if (result) {
        return result;
      }
    }
  }

  signal.throwIfAborted();

  if (mediaType === "application/json") {
    result = readRpcResult(safeParseJson(buffer + decoder.decode()), id);
  }

  if (!result) {
    throw new McpProtocolError("invalid_response");
  }

  return result;
}
