import { ProtocolError, SdkError, SdkErrorCode } from "@modelcontextprotocol/client";

export type McpFailureCode =
  | "unsafe_url"
  | "unauthorised"
  | "http_error"
  | "rpc_error"
  | "invalid_response"
  | "timeout"
  | "network_error";

export class McpRequestError extends Error {
  readonly code: McpFailureCode;
  readonly operation: string;
  readonly status?: number;
  readonly requestSent: boolean;

  constructor(params: {
    code: McpFailureCode;
    operation: string;
    message: string;
    requestSent: boolean;
    status?: number;
  }) {
    super(params.message);
    this.name = "McpRequestError";
    this.code = params.code;
    this.operation = params.operation;
    this.status = params.status;
    this.requestSent = params.requestSent;
  }
}

function readSdkFailureMessage(error: unknown): string {
  if (SdkError.isInstance(error) && error.code === SdkErrorCode.UnsupportedResultType) {
    return "This MCP tool needs a further step that Polychat cannot complete yet.";
  }

  return "The MCP server returned a response that is not valid MCP.";
}

export function toMcpRequestError(error: unknown, operation: string): McpRequestError {
  if (error instanceof McpRequestError) {
    return error;
  }

  if (error instanceof Error && error.cause instanceof McpRequestError) {
    return error.cause;
  }

  if (ProtocolError.isInstance(error)) {
    return new McpRequestError({
      code: "rpc_error",
      operation,
      message: error.message || "The MCP server rejected the request.",
      requestSent: true,
    });
  }

  return new McpRequestError({
    code: "invalid_response",
    operation,
    message: readSdkFailureMessage(error),
    requestSent: true,
  });
}
