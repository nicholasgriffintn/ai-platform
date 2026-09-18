export type ProviderErrorCode =
  | "duplicate_registration"
  | "unknown_category"
  | "unknown_provider"
  | "credential_required"
  | "credential_unavailable"
  | "credential_missing";

export interface ProviderErrorDetails {
  category?: string;
  providerName?: string;
  cause?: unknown;
}

export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly category?: string;
  readonly providerName?: string;
  readonly cause?: unknown;

  constructor(code: ProviderErrorCode, message: string, details: ProviderErrorDetails = {}) {
    super(message);

    this.name = "ProviderError";
    this.code = code;
    this.category = details.category;
    this.providerName = details.providerName;
    this.cause = details.cause;
  }
}

export function isProviderError(error: unknown): error is ProviderError {
  return error instanceof ProviderError;
}
