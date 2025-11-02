import { getLogger } from "./logger";

const logger = getLogger({ prefix: "utils/errors" });

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

	static fromError(
		error: Error,
		type?: ErrorType,
		context: ErrorContext = {},
	): AssistantError {
		return new AssistantError(
			error.message,
			type || ErrorType.UNKNOWN_ERROR,
			500,
			{
				...context,
				originalError: error.name,
				stack: error.stack,
			},
		);
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

	/**
	 * Get user-safe error message (strips sensitive information)
	 */
	getUserMessage(): string {
		const userSafeMessages: Partial<Record<ErrorType, string>> = {
			[ErrorType.AUTHENTICATION_ERROR]:
				"Authentication failed. Please check your credentials.",
			[ErrorType.RATE_LIMIT_ERROR]: this.message,
			[ErrorType.PARAMS_ERROR]: "Invalid request parameters.",
			[ErrorType.NOT_FOUND]: "Requested resource not found.",
			[ErrorType.FORBIDDEN]: "Access denied.",
			[ErrorType.UNAUTHORIZED]: "Authentication required.",
			[ErrorType.USAGE_LIMIT_ERROR]: this.message,
			[ErrorType.CONFLICT_ERROR]: "Resource conflict occurred.",
		};

		return (
			userSafeMessages[this.type] ||
			"An internal error occurred. Please try again later."
		);
	}
}

export function handleAIServiceError(error: AssistantError): Response {
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
			logger.debug("Rate limit exceeded", logContext);

			return Response.json(
				{
					error: error.getUserMessage(),
					retryAfter: 60,
					requestId: error.context.requestId,
				},
				{ status: 429 },
			);
		case ErrorType.AUTHENTICATION_ERROR:
		case ErrorType.UNAUTHORIZED:
			logger.debug("Authentication error", logContext);

			return Response.json(
				{
					error: error.getUserMessage(),
					requestId: error.context.requestId,
				},
				{ status: 401 },
			);
		case ErrorType.FORBIDDEN:
			logger.debug("Authorization error", logContext);

			return Response.json(
				{
					error: error.getUserMessage(),
					requestId: error.context.requestId,
				},
				{ status: 403 },
			);
		case ErrorType.PARAMS_ERROR:
			logger.debug("Parameter validation error", logContext);

			return Response.json(
				{
					error: error.getUserMessage(),
					details: error.context.validationErrors,
					requestId: error.context.requestId,
				},
				{ status: 400 },
			);
		case ErrorType.NOT_FOUND:
		case ErrorType.USER_NOT_FOUND:
			logger.info("Resource not found", logContext);

			return Response.json(
				{
					error: error.getUserMessage(),
					requestId: error.context.requestId,
				},
				{ status: 404 },
			);
		case ErrorType.CONFLICT_ERROR:
			logger.debug("Resource conflict", logContext);

			return Response.json(
				{
					error: error.getUserMessage(),
					requestId: error.context.requestId,
				},
				{ status: 409 },
			);
		case ErrorType.CONTEXT_WINDOW_EXCEEDED:
			logger.debug("Context window exceeded", logContext);

			return Response.json(
				{
					error: "Request too large. Please reduce the input size.",
					requestId: error.context.requestId,
				},
				{ status: 413 },
			);
		case ErrorType.USAGE_LIMIT_ERROR:
			logger.debug("Usage limit exceeded", logContext);

			return Response.json(
				{
					error: error.getUserMessage(),
					requestId: error.context.requestId,
				},
				{ status: 429 },
			);
		case ErrorType.PROVIDER_ERROR:
		case ErrorType.EXTERNAL_API_ERROR:
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
		default:
			logger.error("Unknown error occurred", logContext);

			return Response.json(
				{
					error: "An unexpected error occurred",
					requestId: error.context.requestId,
				},
				{ status: 500 },
			);
	}
}
