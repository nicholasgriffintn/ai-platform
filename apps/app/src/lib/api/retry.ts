import { ApiError } from "./fetch-wrapper";

const DEFAULT_QUERY_RETRY_COUNT = 2;
const RETRYABLE_HTTP_STATUS_CODES = new Set([408, 409, 425, 429]);
const RETRYABLE_ERROR_NAMES = new Set(["AbortError", "FetchError", "TimeoutError"]);

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function getNumericProperty(
	value: Record<string, unknown>,
	propertyName: string,
): number | undefined {
	const propertyValue = value[propertyName];
	return typeof propertyValue === "number" ? propertyValue : undefined;
}

function getErrorStatus(error: unknown): number | undefined {
	if (error instanceof ApiError) {
		return error.status;
	}

	if (!isRecord(error)) {
		return undefined;
	}

	return getNumericProperty(error, "status") ?? getNumericProperty(error, "statusCode");
}

function hasRetryableNetworkShape(error: unknown): boolean {
	return (
		error instanceof TypeError || (error instanceof Error && RETRYABLE_ERROR_NAMES.has(error.name))
	);
}

export function shouldRetryApiQuery(failureCount: number, error: unknown): boolean {
	if (failureCount >= DEFAULT_QUERY_RETRY_COUNT) {
		return false;
	}

	const status = getErrorStatus(error);
	if (status !== undefined) {
		return RETRYABLE_HTTP_STATUS_CODES.has(status) || status >= 500;
	}

	return hasRetryableNetworkShape(error);
}
