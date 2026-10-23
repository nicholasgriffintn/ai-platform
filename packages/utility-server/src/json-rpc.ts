import {
  JSON_RPC_ERRORS,
  jsonRpcRequestSchema,
  type JsonRpcPayload,
  type JsonRpcRequest,
  type JsonRpcResponse,
} from "@ngriffin_uk/polychat-schemas";

import { AssistantError, ErrorType } from "./errors.js";

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

export type JsonRpcHandlers = Readonly<Record<string, JsonRpcMethodHandler>>;

const ASSISTANT_ERROR_CODES: Partial<Record<ErrorType, number>> = {
  [ErrorType.PARAMS_ERROR]: JSON_RPC_ERRORS.invalidParams,
  [ErrorType.NOT_FOUND]: JSON_RPC_ERRORS.invalidParams,
  [ErrorType.AUTHORISATION_ERROR]: JSON_RPC_ERRORS.invalidRequest,
  [ErrorType.AUTHENTICATION_ERROR]: JSON_RPC_ERRORS.invalidRequest,
  [ErrorType.FORBIDDEN]: JSON_RPC_ERRORS.invalidRequest,
  [ErrorType.CONFLICT_ERROR]: JSON_RPC_ERRORS.invalidRequest,
};

export function isJsonRpcNotification(request: JsonRpcRequest): boolean {
  return request.id === undefined || request.id === null;
}

function toJsonRpcError(error: unknown): NonNullable<JsonRpcResponse["error"]> {
  if (error instanceof JsonRpcError) {
    return {
      code: error.code,
      message: error.message,
      ...(error.data !== undefined ? { data: error.data } : {}),
    };
  }

  if (error instanceof AssistantError) {
    const code = ASSISTANT_ERROR_CODES[error.type];

    if (code !== undefined) {
      return { code, message: error.message, data: { type: error.type } };
    }
  }

  return { code: JSON_RPC_ERRORS.internal, message: "The request failed" };
}

export function jsonRpcErrorResponse(id: JsonRpcResponse["id"], error: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: toJsonRpcError(error) };
}

export async function dispatchJsonRpc(
  message: unknown,
  handlers: JsonRpcHandlers,
): Promise<JsonRpcResponse | null> {
  const parsed = jsonRpcRequestSchema.safeParse(message);

  if (!parsed.success) {
    return {
      jsonrpc: "2.0",
      id: null,
      error: { code: JSON_RPC_ERRORS.invalidRequest, message: "Expected a JSON-RPC 2.0 request" },
    };
  }

  const request = parsed.data;
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
    return jsonRpcErrorResponse(id, error);
  }
}

export async function dispatchJsonRpcPayload(
  payload: JsonRpcPayload,
  handlers: JsonRpcHandlers,
): Promise<JsonRpcResponse[]> {
  const messages = Array.isArray(payload) ? payload : [payload];
  const responses = await Promise.all(
    messages.map((message) => dispatchJsonRpc(message, handlers)),
  );

  return responses.filter((response) => response !== null);
}
