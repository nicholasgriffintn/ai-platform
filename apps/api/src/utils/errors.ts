export enum ErrorType {
	CONFIGURATION_ERROR = "CONFIGURATION_ERROR",
	NETWORK_ERROR = "NETWORK_ERROR",
	AUTHENTICATION_ERROR = "AUTHENTICATION_ERROR",
	RATE_LIMIT_ERROR = "RATE_LIMIT_ERROR",
	PARAMS_ERROR = "PARAMS_ERROR",
	NOT_FOUND = "NOT_FOUND",
	PROVIDER_ERROR = "PROVIDER_ERROR",
	UNKNOWN_ERROR = "UNKNOWN_ERROR",
	EXTERNAL_API_ERROR = "EXTERNAL_API_ERROR",
	FORBIDDEN = "FORBIDDEN",
	UNAUTHORIZED = "UNAUTHORIZED",
}

export class AssistantError extends Error {
	type: ErrorType;
	statusCode?: number;
	context?: Record<string, any>;

	constructor(
		message: string,
		type: ErrorType = ErrorType.UNKNOWN_ERROR,
		statusCode?: number,
		context?: Record<string, any>,
	) {
		super(message);
		this.name = "AssistantError";
		this.type = type;
		this.statusCode = statusCode || 500;
		this.context = context;
	}

	static fromError(error: Error, type?: ErrorType): AssistantError {
		return new AssistantError(
			error.message,
			type || ErrorType.UNKNOWN_ERROR,
			500,
			{ originalError: error },
		);
	}

	toJSON() {
		return {
			message: this.message,
			type: this.type,
			context: this.context,
		};
	}
}

export function handleAIServiceError(error: AssistantError): Response {
	switch (error.type) {
		case ErrorType.CONFIGURATION_ERROR:
			console.error("Configuration error:", error.message);

			return Response.json({ error: error.message }, { status: 500 });
		case ErrorType.NETWORK_ERROR:
			console.error("Network error:", error.message, error.context);

			return Response.json({ error: error.message }, { status: 500 });
		case ErrorType.RATE_LIMIT_ERROR:
			return Response.json({ error: error.message }, { status: 429 });
		case ErrorType.AUTHENTICATION_ERROR:
			return Response.json({ error: error.message }, { status: 401 });
		case ErrorType.PARAMS_ERROR:
			return Response.json({ error: error.message }, { status: 400 });
		case ErrorType.NOT_FOUND:
			return Response.json({ error: error.message }, { status: 404 });
		case ErrorType.PROVIDER_ERROR:
			console.error("Provider error:", error.message, error.context);
			return Response.json({ error: error.message }, { status: 500 });
		default:
			console.error("Unknown error:", error.message, error.context);

			return Response.json(
				{ error: error.message },
				{ status: error.statusCode },
			);
	}
}
