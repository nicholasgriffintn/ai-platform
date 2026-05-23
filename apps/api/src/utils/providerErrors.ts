import { isPlainObject } from "~/utils/objects";

export interface ProviderErrorBody {
	raw_status_code?: unknown;
	code?: unknown;
	type?: unknown;
	message?: unknown;
	error?: unknown;
}

interface ProviderErrorLike extends ProviderErrorBody {
	status?: unknown;
	statusCode?: unknown;
}

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
