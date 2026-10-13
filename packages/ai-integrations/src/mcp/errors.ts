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
