export type SandboxErrorCode =
  | "cancelled"
  | "timeout"
  | "stale_lease"
  | "invalid_lease"
  | "invalid_options"
  | "invalid_result"
  | "network_blocked"
  | "tool_unavailable"
  | "gateway_unavailable"
  | "execution_failed";

export class SandboxError extends Error {
  readonly code: SandboxErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: SandboxErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);

    this.name = "SandboxError";
    this.code = code;
    this.details = details;
  }
}

export function isSandboxError(error: unknown, code?: SandboxErrorCode): error is SandboxError {
  return error instanceof SandboxError && (code === undefined || error.code === code);
}

export class SandboxCancellationError extends SandboxError {
  constructor(message = "Sandbox run cancelled") {
    super("cancelled", message);

    this.name = "SandboxCancellationError";
  }
}

export class SandboxTimeoutError extends SandboxError {
  constructor(message: string) {
    super("timeout", message);

    this.name = "SandboxTimeoutError";
  }
}

export function throwIfAborted(signal?: AbortSignal, message?: string): void {
  if (!signal?.aborted) {
    return;
  }

  throw new SandboxCancellationError(message);
}
