export type InteractionErrorCode =
  | "approval_unavailable"
  | "approval_request_failed"
  | "approval_cancelled";

export class InteractionError extends Error {
  readonly code: InteractionErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: InteractionErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);

    this.name = "InteractionError";
    this.code = code;
    this.details = details;
  }
}

export function isInteractionError(
  error: unknown,
  code?: InteractionErrorCode,
): error is InteractionError {
  return error instanceof InteractionError && (code === undefined || error.code === code);
}
