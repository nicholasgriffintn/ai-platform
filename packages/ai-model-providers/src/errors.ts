export type ModelProviderErrorCode =
  | "invalid_reference"
  | "not_found"
  | "unauthorised"
  | "rate_limited"
  | "unsupported"
  | "misconfigured"
  | "upstream_error";

export class ModelProviderError extends Error {
  readonly code: ModelProviderErrorCode;
  readonly status?: number;

  constructor(code: ModelProviderErrorCode, message: string, status?: number) {
    super(message);

    this.name = "ModelProviderError";
    this.code = code;
    this.status = status;
  }
}

export function isModelProviderError(
  error: unknown,
  code?: ModelProviderErrorCode,
): error is ModelProviderError {
  return error instanceof ModelProviderError && (code === undefined || error.code === code);
}

export function modelProviderErrorFromStatus(
  status: number,
  context: string,
  detail?: string,
): ModelProviderError {
  if (status === 404) {
    return new ModelProviderError("not_found", `${context} was not found`, status);
  }

  if (status === 401 || status === 403) {
    return new ModelProviderError(
      "unauthorised",
      `${context} was refused by the provider${detail ? `: ${detail}` : ""}`,
      status,
    );
  }

  if (status === 429) {
    return new ModelProviderError("rate_limited", `${context} hit the provider rate limit`, status);
  }

  return new ModelProviderError(
    "upstream_error",
    `${context} failed with status ${status}${detail ? `: ${detail}` : ""}`,
    status,
  );
}

export function unsupported(message: string): ModelProviderError {
  return new ModelProviderError("unsupported", message);
}

export function misconfigured(message: string): ModelProviderError {
  return new ModelProviderError("misconfigured", message);
}
