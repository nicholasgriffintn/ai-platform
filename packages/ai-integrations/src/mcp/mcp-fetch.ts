import {
  ResponseBodyTooLargeError,
  readResponseTextWithinLimit,
} from "@ngriffin_uk/polychat-utility-server/http";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";
import z from "zod/v4";

import { McpRequestError } from "./errors.js";
import { readJsonRpcResponse } from "./rpc-response.js";

const MAX_RESPONSE_BYTES = 2_000_000;
const INVALID_REPLY_CODE = -32603;

const outboundMessageSchema = z.object({
  id: z.union([z.number(), z.string()]).optional(),
  method: z.string(),
  params: z.object({ name: z.unknown() }).partial().optional(),
});

type OutboundMessage = z.infer<typeof outboundMessageSchema>;

export type McpFetch = (url: string | URL, init?: RequestInit) => Promise<Response>;

function readOutboundMessage(body: RequestInit["body"]): OutboundMessage {
  const parsed = outboundMessageSchema.safeParse(
    typeof body === "string" ? safeParseJson(body) : undefined,
  );

  if (!parsed.success) {
    throw new McpRequestError({
      code: "invalid_response",
      operation: "connect",
      message: "The MCP request could not be prepared.",
      requestSent: false,
    });
  }

  return parsed.data;
}

function operationOf(message: OutboundMessage): string {
  if (message.method === "tools/call" && typeof message.params?.name === "string") {
    return message.params.name;
  }

  return message.method === "server/discover" ? "initialize" : message.method;
}

function invalidResponse(operation: string, message: string): McpRequestError {
  return new McpRequestError({ code: "invalid_response", operation, message, requestSent: true });
}

function boundedSignal(init: RequestInit, timeoutMs: number): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);

  return init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
}

async function send(
  fetchImpl: typeof globalThis.fetch,
  url: string | URL,
  init: RequestInit,
  message: OutboundMessage,
  timeoutMs: number,
): Promise<Response> {
  try {
    return await fetchImpl(url.toString(), {
      ...init,
      redirect: "manual",
      ...(message.method === "tools/call" ? {} : { signal: boundedSignal(init, timeoutMs) }),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    const cause = error instanceof Error ? error.message.slice(0, 160) : "";

    throw new McpRequestError({
      code: timedOut ? "timeout" : "network_error",
      operation: operationOf(message),
      message: timedOut
        ? "The MCP server did not answer in time."
        : `The MCP server could not be reached${cause ? ` (${cause})` : ""}.`,
      requestSent: timedOut,
    });
  }
}

async function readBody(response: Response, operation: string): Promise<string> {
  try {
    return await readResponseTextWithinLimit(response, MAX_RESPONSE_BYTES);
  } catch (error) {
    throw invalidResponse(
      operation,
      error instanceof ResponseBodyTooLargeError
        ? "The MCP server returned more data than one call can carry."
        : "The MCP server response could not be read.",
    );
  }
}

function assertAuthorised(response: Response, operation: string): void {
  if (response.status === 401 || response.status === 403) {
    throw new McpRequestError({
      code: "unauthorised",
      operation,
      status: response.status,
      message: "The MCP server rejected the credentials. Reconnect it and try again.",
      requestSent: true,
    });
  }
}

async function toRequestReply(
  response: Response,
  id: string | number,
  operation: string,
): Promise<Response> {
  assertAuthorised(response, operation);

  if (response.status === 400) {
    return new Response(await readBody(response, operation), { status: 400 });
  }

  if (!response.ok) {
    throw new McpRequestError({
      code: "http_error",
      operation,
      status: response.status,
      message: `The MCP server answered with HTTP ${response.status}.`,
      requestSent: true,
    });
  }

  const reply = readJsonRpcResponse(
    await readBody(response, operation),
    response.headers.get("content-type"),
    id,
  );

  if (!reply) {
    throw invalidResponse(operation, "The MCP server returned a response that is not valid MCP.");
  }

  const headers = new Headers({ "content-type": "application/json" });
  const sessionId = response.headers.get("mcp-session-id");

  if (sessionId) {
    headers.set("mcp-session-id", sessionId);
  }

  return new Response(
    JSON.stringify({
      ...reply,
      jsonrpc: "2.0",
      ...(reply.error
        ? {
            error: {
              ...reply.error,
              code: reply.error.code ?? INVALID_REPLY_CODE,
              message: reply.error.message ?? "The MCP server rejected the request.",
            },
          }
        : {}),
    }),
    { status: 200, headers },
  );
}

async function toProbeReply(response: Response, id: string | number): Promise<Response> {
  try {
    return await toRequestReply(response, id, "initialize");
  } catch (error) {
    if (error instanceof McpRequestError && error.code !== "unauthorised") {
      return new Response(null, { status: 400 });
    }

    throw error;
  }
}

export function createMcpFetch(options: {
  fetch: typeof globalThis.fetch;
  timeoutMs: number;
}): McpFetch {
  return async (url, init = {}) => {
    if (init.method !== "POST") {
      return new Response(null, { status: 405 });
    }

    const message = readOutboundMessage(init.body);

    if (message.id === undefined) {
      try {
        const response = await send(options.fetch, url, init, message, options.timeoutMs);

        await response.body?.cancel();
      } catch {
        return new Response(null, { status: 202 });
      }

      return new Response(null, { status: 202 });
    }

    const response = await send(options.fetch, url, init, message, options.timeoutMs);

    return message.method === "server/discover"
      ? toProbeReply(response, message.id)
      : toRequestReply(response, message.id, operationOf(message));
  };
}
