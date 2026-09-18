import { AuthError, type AuthErrorCode } from "@ngriffin_uk/auth-core";
import { isProviderError, type ProviderError } from "@ngriffin_uk/polychat-ai-providers";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { isGoalError, type GoalError } from "@ngriffin_uk/polychat-library-goals";
import { isTaskError, type TaskError } from "@ngriffin_uk/polychat-library-tasks";
import { isToolError, type ToolError } from "@ngriffin_uk/polychat-library-tools";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

const logger = getLogger({ prefix: "utils/errors" });

export function normaliseApiError(error: Error): AssistantError {
  if (error instanceof AssistantError) {
    return error;
  }

  if (isProviderError(error)) {
    return fromProviderError(error);
  }

  if (isToolError(error)) {
    return fromToolError(error);
  }

  if (isTaskError(error)) {
    return fromTaskError(error);
  }

  if (isGoalError(error)) {
    return fromGoalError(error);
  }

  if (!(error instanceof AuthError)) {
    return AssistantError.fromError(error);
  }

  const [type, statusCode] = authErrorResponse(error.code);

  return new AssistantError(error.message, type, statusCode);
}

export function fromGoalError(error: GoalError): AssistantError {
  switch (error.code) {
    case "forbidden_transition":
      return new AssistantError(error.message, ErrorType.PARAMS_ERROR, 400, error.details);
    default:
      return new AssistantError(error.message, ErrorType.CONFIGURATION_ERROR, 500, error.details);
  }
}

export function fromTaskError(error: TaskError): AssistantError {
  switch (error.code) {
    case "forbidden_transition":
      return new AssistantError(error.message, ErrorType.FORBIDDEN, 403, error.details);
    case "lease_busy":
    case "ownership_lost":
      return new AssistantError(error.message, ErrorType.CONFLICT_ERROR, 409, error.details);
    default:
      return new AssistantError(error.message, ErrorType.CONFIGURATION_ERROR, 500, error.details);
  }
}

export function fromToolError(error: ToolError): AssistantError {
  switch (error.code) {
    case "invalid_input":
      return new AssistantError(error.message, ErrorType.PARAMS_ERROR, 400, {
        validationErrors: error.issues,
      });
    case "unknown_tool":
      return new AssistantError(error.message, ErrorType.PARAMS_ERROR, 500, {
        category: error.category,
        reason: "unknown_tool",
        toolName: error.toolName,
      });
    default:
      return new AssistantError(error.message, ErrorType.CONFIGURATION_ERROR);
  }
}

export function fromProviderError(error: ProviderError): AssistantError {
  if (error.code === "credential_required") {
    return new AssistantError(error.message, ErrorType.AUTHORISATION_ERROR, 403);
  }

  return new AssistantError(error.message, ErrorType.CONFIGURATION_ERROR);
}

function authErrorResponse(code: AuthErrorCode): readonly [ErrorType, number] {
  switch (code) {
    case "invalid_input":
      return [ErrorType.PARAMS_ERROR, 400];
    case "rate_limited":
      return [ErrorType.RATE_LIMIT_ERROR, 429];
    case "oauth_exchange_failed":
    case "provider_error":
      return [ErrorType.PROVIDER_ERROR, 502];
    case "storage_error":
      return [ErrorType.STORAGE_ERROR, 500];
    case "duplicate_plugin":
    case "insecure_runtime":
    case "provider_not_found":
    case "unsupported_operation":
      return [ErrorType.CONFIGURATION_ERROR, 500];
    case "email_in_use":
    case "identity_conflict":
      return [ErrorType.CONFLICT_ERROR, 409];
    case "challenge_expired":
    case "challenge_mismatch":
    case "invalid_callback":
    case "invalid_credentials":
    case "session_expired":
    default:
      return [ErrorType.AUTHENTICATION_ERROR, 401];
  }
}

export function handleAIServiceError(error: AssistantError): Response {
  const clientStatus = (fallback: number) =>
    error.statusCode && error.statusCode >= 400 && error.statusCode < 500
      ? error.statusCode
      : fallback;
  const logContext = {
    errorType: error.type,
    statusCode: error.statusCode,
    message: error.message,
    context: error.context,
    timestamp: error.timestamp,
  };

  switch (error.type) {
    case ErrorType.CONFIGURATION_ERROR:
      logger.error("Configuration error occurred", logContext);

      return Response.json(
        {
          error: "Service configuration error",
          requestId: error.context.requestId,
        },
        { status: 500 },
      );
    case ErrorType.NETWORK_ERROR:
      logger.error("Network error occurred", logContext);

      return Response.json(
        {
          error: "Network connectivity issue",
          requestId: error.context.requestId,
        },
        { status: 500 },
      );
    case ErrorType.RATE_LIMIT_ERROR:
      logger.error("Rate limit exceeded", logContext);

      return Response.json(
        {
          error: error.getUserMessage(),
          retryAfter: 60,
          requestId: error.context.requestId,
        },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    case ErrorType.AUTHENTICATION_ERROR:
    case ErrorType.UNAUTHORIZED:
      return Response.json(
        {
          error: error.getUserMessage(),
          requestId: error.context.requestId,
        },
        { status: 401 },
      );
    case ErrorType.FORBIDDEN:
    case ErrorType.AUTHORISATION_ERROR:
      return Response.json(
        {
          error: error.getUserMessage(),
          requestId: error.context.requestId,
        },
        { status: 403 },
      );
    case ErrorType.PARAMS_ERROR:
      return Response.json(
        {
          error: error.getUserMessage(),
          details: error.context.validationErrors,
          requestId: error.context.requestId,
        },
        { status: clientStatus(400) },
      );
    case ErrorType.NOT_FOUND:
    case ErrorType.USER_NOT_FOUND:
      return Response.json(
        {
          error: error.getUserMessage(),
          requestId: error.context.requestId,
        },
        { status: clientStatus(404) },
      );
    case ErrorType.CONFLICT_ERROR:
      return Response.json(
        {
          error: error.getUserMessage(),
          requestId: error.context.requestId,
        },
        { status: clientStatus(409) },
      );
    case ErrorType.CONTEXT_WINDOW_EXCEEDED:
      return Response.json(
        {
          error: "Request too large. Please reduce the input size.",
          requestId: error.context.requestId,
        },
        { status: 413 },
      );
    case ErrorType.USAGE_LIMIT_ERROR:
      return Response.json(
        {
          error: error.getUserMessage(),
          requestId: error.context.requestId,
        },
        { status: 429 },
      );
    case ErrorType.PROVIDER_ERROR:
    case ErrorType.EXTERNAL_API_ERROR:
    case ErrorType.TOOL_CALL_ERROR:
      logger.error("External service error", logContext);

      return Response.json(
        {
          error: "External service temporarily unavailable",
          requestId: error.context.requestId,
        },
        { status: 502 },
      );
    case ErrorType.EMAIL_SEND_FAILED:
      logger.error("Email service error", logContext);

      return Response.json(
        {
          error: "Email delivery failed",
          requestId: error.context.requestId,
        },
        { status: 500 },
      );
    case ErrorType.STORAGE_ERROR:
      logger.error("Storage service error", logContext);

      return Response.json(
        {
          error: "Storage service temporarily unavailable",
          requestId: error.context.requestId,
        },
        { status: 500 },
      );
    case ErrorType.DATABASE_ERROR:
      logger.error("Database error", logContext);

      return Response.json(
        {
          error: "Database service temporarily unavailable",
          requestId: error.context.requestId,
        },
        { status: 500 },
      );
    case ErrorType.UNKNOWN_ERROR:
    case ErrorType.INTERNAL_ERROR:
    default:
      logger.error("Unknown error occurred", logContext);

      return Response.json(
        {
          error: "An unexpected error occurred",
          requestId: error.context?.requestId,
        },
        { status: 500 },
      );
  }
}
