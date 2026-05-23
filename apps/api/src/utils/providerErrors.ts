import { isPlainObject } from "~/utils/objects";

export interface ProviderErrorBody {
	raw_status_code?: unknown;
	code?: unknown;
	type?: unknown;
	message?: unknown;
	error?: unknown;
}

interface ProviderErrorLike extends ProviderErrorBody {
	name?: unknown;
	status?: unknown;
	statusCode?: unknown;
}

const retryableNetworkErrorCodes = new Set([
	"ECONNRESET",
	"ECONNABORTED",
	"ETIMEDOUT",
	"ENOTFOUND",
	"ECONNREFUSED",
	"ENETUNREACH",
]);

const retryableErrorNames = new Set(["AbortError", "FetchError", "TimeoutError"]);

const nonRetryableErrorTypes = new Set([
	"AUTHENTICATION_ERROR",
	"AUTHORISATION_ERROR",
	"CONFIGURATION_ERROR",
	"CONTEXT_WINDOW_EXCEEDED",
	"CONFLICT_ERROR",
	"DATABASE_ERROR",
	"EMAIL_SEND_FAILED",
	"FORBIDDEN",
	"INTERNAL_ERROR",
	"NOT_FOUND",
	"PARAMS_ERROR",
	"STORAGE_ERROR",
	"TOOL_CALL_ERROR",
	"UNAUTHORIZED",
	"UNKNOWN_ERROR",
	"USAGE_LIMIT_ERROR",
	"USER_NOT_FOUND",
]);

const retryableStatusCodes = new Set([408, 409, 425]);

function isProviderErrorLike(error: unknown): error is ProviderErrorLike {
	return typeof error === "object" && error !== null && !Array.isArray(error);
}

export function getProviderErrorMessage(
	responseJson: ProviderErrorBody | null,
): string | undefined {
	if (typeof responseJson?.message === "string") {
		return responseJson.message;
	}

	const nestedError = responseJson?.error;
	if (typeof nestedError === "string") {
		return nestedError;
	}

	if (nestedError && typeof nestedError === "object" && "message" in nestedError) {
		const message = (nestedError as { message?: unknown }).message;
		return typeof message === "string" ? message : undefined;
	}

	return undefined;
}

export function isProviderRateLimit(
	responseStatus: number,
	responseJson: ProviderErrorBody | null,
): boolean {
	if (responseStatus === 429 || responseJson?.raw_status_code === 429) {
		return true;
	}

	const code = typeof responseJson?.code === "string" ? responseJson.code : "";
	const type = typeof responseJson?.type === "string" ? responseJson.type : "";

	return code === "1300" || type === "rate_limited";
}

export function isProviderRateLimitError(error: unknown): boolean {
	if (!isProviderErrorLike(error)) {
		return false;
	}

	if (error.type === "RATE_LIMIT_ERROR" || error.status === 429 || error.statusCode === 429) {
		return true;
	}

	if (isProviderRateLimit(0, error)) {
		return true;
	}

	return isPlainObject(error.error) && isProviderRateLimit(0, error.error);
}

function getProviderErrorStatus(error: ProviderErrorLike): number | undefined {
	if (typeof error.status === "number") {
		return error.status;
	}

	return typeof error.statusCode === "number" ? error.statusCode : undefined;
}

export function isRetryableProviderError(error: unknown): boolean {
	if (!isProviderErrorLike(error)) {
		return false;
	}

	if (isProviderRateLimitError(error) || error.type === "NETWORK_ERROR") {
		return true;
	}

	if (typeof error.type === "string" && nonRetryableErrorTypes.has(error.type)) {
		return false;
	}

	if (typeof error.code === "string" && retryableNetworkErrorCodes.has(error.code)) {
		return true;
	}

	if (typeof error.name === "string" && retryableErrorNames.has(error.name)) {
		return true;
	}

	const status = getProviderErrorStatus(error);
	return status !== undefined && (retryableStatusCodes.has(status) || status >= 500);
}
