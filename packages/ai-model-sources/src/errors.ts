export type ModelSourceErrorCode =
  | "invalid_reference"
  | "not_found"
  | "unauthorised"
  | "rate_limited"
  | "upstream_error";

export class ModelSourceError extends Error {
  readonly code: ModelSourceErrorCode;
  readonly status?: number;

  constructor(code: ModelSourceErrorCode, message: string, status?: number) {
    super(message);

    this.name = "ModelSourceError";
    this.code = code;
    this.status = status;
  }
}

export function isModelSourceError(
  error: unknown,
  code?: ModelSourceErrorCode,
): error is ModelSourceError {
  return error instanceof ModelSourceError && (code === undefined || error.code === code);
}

export function modelSourceErrorFromStatus(
  status: number,
  context: string,
  detail?: string,
): ModelSourceError {
  if (status === 404) {
    return new ModelSourceError("not_found", `${context} was not found`, status);
  }

  if (status === 401 || status === 403) {
    return new ModelSourceError(
      "unauthorised",
      `${context} needs an access token that has accepted its terms`,
      status,
    );
  }

  if (status === 429) {
    return new ModelSourceError("rate_limited", `${context} hit the source rate limit`, status);
  }

  return new ModelSourceError(
    "upstream_error",
    `${context} failed with status ${status}${detail ? `: ${detail}` : ""}`,
    status,
  );
}
