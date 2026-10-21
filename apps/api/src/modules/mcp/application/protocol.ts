import type { JsonRpcRequest } from "@ngriffin_uk/polychat-schemas";

export const MCP_SERVER_PROTOCOL_VERSION = "2025-06-18";

export const JSON_RPC_ERRORS = {
  parse: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  internal: -32603,
} as const;

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number | string | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export class JsonRpcError extends Error {
  constructor(
    readonly code: number,
    message: string,
    readonly data?: unknown,
  ) {
    super(message);
    this.name = "JsonRpcError";
  }
}

export type JsonRpcMethodHandler = (params: unknown) => Promise<unknown> | unknown;

export function isJsonRpcNotification(request: JsonRpcRequest): boolean {
  return request.id === undefined || request.id === null;
}

export async function dispatchJsonRpc(
  request: JsonRpcRequest,
  handlers: Readonly<Record<string, JsonRpcMethodHandler>>,
): Promise<JsonRpcResponse | null> {
  const handler = Object.hasOwn(handlers, request.method) ? handlers[request.method] : undefined;
  const id = request.id ?? null;

  if (isJsonRpcNotification(request)) {
    if (handler) {
      try {
        await handler(request.params);
      } catch {
        return null;
      }
    }

    return null;
  }

  if (!handler) {
    return {
      jsonrpc: "2.0",
      id,
      error: {
        code: JSON_RPC_ERRORS.methodNotFound,
        message: `${request.method} is not supported`,
      },
    };
  }

  try {
    return { jsonrpc: "2.0", id, result: await handler(request.params) };
  } catch (error) {
    if (error instanceof JsonRpcError) {
      return {
        jsonrpc: "2.0",
        id,
        error: {
          code: error.code,
          message: error.message,
          ...(error.data ? { data: error.data } : {}),
        },
      };
    }

    return {
      jsonrpc: "2.0",
      id,
      error: {
        code: JSON_RPC_ERRORS.internal,
        message: error instanceof Error ? error.message : "The request failed",
      },
    };
  }
}
