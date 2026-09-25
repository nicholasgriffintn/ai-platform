export type ModelRegistryErrorCode = "malformed_file" | "unsupported_format" | "truncated_input";

export class ModelRegistryError extends Error {
  readonly code: ModelRegistryErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: ModelRegistryErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);

    this.name = "ModelRegistryError";
    this.code = code;
    this.details = details;
  }
}

export function isModelRegistryError(
  error: unknown,
  code?: ModelRegistryErrorCode,
): error is ModelRegistryError {
  return error instanceof ModelRegistryError && (code === undefined || error.code === code);
}
