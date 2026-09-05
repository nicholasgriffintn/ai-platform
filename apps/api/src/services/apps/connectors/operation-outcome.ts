import type { ConnectorOperationConfig } from "~/lib/providers/capabilities/connectors";
import { AssistantError, ErrorType } from "~/utils/errors";

const DEFINITIVE_FAILURE_TYPES = new Set([
  ErrorType.AUTHENTICATION_ERROR,
  ErrorType.AUTHORISATION_ERROR,
  ErrorType.CONFIGURATION_ERROR,
  ErrorType.CONFLICT_ERROR,
  ErrorType.FORBIDDEN,
  ErrorType.NOT_FOUND,
  ErrorType.PARAMS_ERROR,
  ErrorType.UNAUTHORIZED,
  ErrorType.USAGE_LIMIT_ERROR,
]);

function isUncertainTransportFailure(error: unknown): boolean {
  if (!(error instanceof AssistantError)) {
    return (
      error instanceof TypeError ||
      (error instanceof Error && ["AbortError", "FetchError", "TimeoutError"].includes(error.name))
    );
  }

  if (DEFINITIVE_FAILURE_TYPES.has(error.type) || error.type === ErrorType.RATE_LIMIT_ERROR) {
    return false;
  }

  const transientStatus =
    error.statusCode === undefined ||
    error.statusCode === 408 ||
    error.statusCode === 425 ||
    error.statusCode >= 500;

  return (
    error.type === ErrorType.NETWORK_ERROR ||
    (transientStatus &&
      (error.type === ErrorType.EXTERNAL_API_ERROR ||
        error.type === ErrorType.PROVIDER_ERROR ||
        error.type === ErrorType.UNKNOWN_ERROR))
  );
}

export function normaliseConnectorOperationFailure(params: {
  provider: string;
  operation: ConnectorOperationConfig;
  error: unknown;
}): unknown {
  if (params.operation.access !== "write") {
    return params.error;
  }

  const rateLimited =
    params.error instanceof AssistantError &&
    (params.error.type === ErrorType.RATE_LIMIT_ERROR || params.error.statusCode === 429);
  const uncertain = isUncertainTransportFailure(params.error);

  if (!rateLimited && !uncertain) {
    return params.error;
  }

  const outcome = uncertain ? "unknown" : "not_applied";
  const retryable = !uncertain || params.operation.idempotent === true;
  const message = uncertain
    ? retryable
      ? `The ${params.provider} write outcome is unknown. It is safe to retry this idempotent operation once with the same parameters.`
      : `The ${params.provider} write may have completed. Check ${params.provider} before trying it again.`
    : `The ${params.provider} write was rate limited before it was applied. Retry it once with the same parameters.`;
  const statusCode = params.error instanceof AssistantError ? params.error.statusCode : 502;
  const requestId =
    params.error instanceof AssistantError && typeof params.error.context?.requestId === "string"
      ? params.error.context.requestId
      : undefined;

  return new AssistantError(message, ErrorType.EXTERNAL_API_ERROR, statusCode, {
    outcome,
    retryable,
    provider: params.provider,
    operation: params.operation.id,
    ...(requestId ? { requestId } : {}),
  });
}
