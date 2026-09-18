export enum ErrorType {
  CONFIGURATION_ERROR = "CONFIGURATION_ERROR",
  NETWORK_ERROR = "NETWORK_ERROR",
  AUTHENTICATION_ERROR = "AUTHENTICATION_ERROR",
  AUTHORISATION_ERROR = "AUTHORISATION_ERROR",
  RATE_LIMIT_ERROR = "RATE_LIMIT_ERROR",
  PARAMS_ERROR = "PARAMS_ERROR",
  NOT_FOUND = "NOT_FOUND",
  PROVIDER_ERROR = "PROVIDER_ERROR",
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
  EXTERNAL_API_ERROR = "EXTERNAL_API_ERROR",
  FORBIDDEN = "FORBIDDEN",
  UNAUTHORIZED = "UNAUTHORIZED",
  CONTEXT_WINDOW_EXCEEDED = "CONTEXT_WINDOW_EXCEEDED",
  EMAIL_SEND_FAILED = "EMAIL_SEND_FAILED",
  INTERNAL_ERROR = "INTERNAL_ERROR",
  USAGE_LIMIT_ERROR = "USAGE_LIMIT_ERROR",
  USER_NOT_FOUND = "USER_NOT_FOUND",
  CONFLICT_ERROR = "CONFLICT_ERROR",
  STORAGE_ERROR = "STORAGE_ERROR",
  DATABASE_ERROR = "DATABASE_ERROR",
  TOOL_CALL_ERROR = "TOOL_CALL_ERROR",
}

export interface ErrorContext {
  userId?: string | number;
  requestId?: string;
  operation?: string;
  resource?: string;
  timestamp?: number;
  [key: string]: any;
}

export class AssistantError extends Error {
  type: ErrorType;
  statusCode?: number;
  context?: ErrorContext;
  timestamp?: number;

  constructor(
    message: string,
    type: ErrorType = ErrorType.UNKNOWN_ERROR,
    statusCode = 500,
    context: ErrorContext = {},
  ) {
    super(message);
    this.name = "AssistantError";
    this.type = type;
    this.statusCode = statusCode;
    this.context = context;
    this.timestamp = Date.now();

    Error.captureStackTrace(this, AssistantError);
  }

  static fromError(error: Error, type?: ErrorType, context: ErrorContext = {}): AssistantError {
    return new AssistantError(error.message, type || ErrorType.UNKNOWN_ERROR, 500, {
      ...context,
      originalError: error.name,
      stack: error.stack,
    });
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      type: this.type,
      statusCode: this.statusCode,
      timestamp: this.timestamp,
      context: this.context,
    };
  }

  getUserMessage(): string {
    const fallbackMessages: Partial<Record<ErrorType, string>> = {
      [ErrorType.AUTHENTICATION_ERROR]: "Authentication failed. Please check your credentials.",
      [ErrorType.PARAMS_ERROR]: "Invalid request parameters.",
      [ErrorType.NOT_FOUND]: "Requested resource not found.",
      [ErrorType.FORBIDDEN]: "Access denied.",
      [ErrorType.AUTHORISATION_ERROR]: "Access denied.",
      [ErrorType.UNAUTHORIZED]: "Authentication required.",
      [ErrorType.CONFLICT_ERROR]: "Resource conflict occurred.",
    };

    const passthroughTypes = new Set([
      ErrorType.RATE_LIMIT_ERROR,
      ErrorType.USAGE_LIMIT_ERROR,
      ErrorType.PARAMS_ERROR,
      ErrorType.NOT_FOUND,
      ErrorType.FORBIDDEN,
      ErrorType.AUTHORISATION_ERROR,
      ErrorType.CONFLICT_ERROR,
    ]);

    if (passthroughTypes.has(this.type) && this.message.trim().length > 0) {
      return this.message;
    }

    return fallbackMessages[this.type] || "An internal error occurred. Please try again later.";
  }
}

export function getErrorMessage(error: unknown, fallback = "Unknown error"): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  if (typeof error === "number" || typeof error === "boolean" || typeof error === "bigint") {
    return String(error);
  }

  return fallback;
}
