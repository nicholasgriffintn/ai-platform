import { API_BASE_URL } from "~/constants";

const DEFAULT_FETCH_TIMEOUT_MS = 15_000;

/**
 * Reads a specific cookie by name.
 * @param name The name of the cookie.
 * @returns The cookie value or null if not found.
 */
function getCookie(name: string): string | null {
	if (typeof document === "undefined") {
		return null;
	}
	const value = `; ${document.cookie}`;
	const parts = value.split(`; ${name}=`);
	if (parts.length === 2) {
		return parts.pop()?.split(";").shift() ?? null;
	}
	return null;
}

/**
 * Options for the fetchApi wrapper, allowing an object for the body.
 */
type FetchApiOptions = Omit<RequestInit, "body"> & {
	body?: BodyInit | object | null;
	timeoutMs?: number | null;
};

export class ApiError extends Error {
	status: number;
	code?: string;
	data?: unknown;

	constructor(message: string, status: number, data?: unknown, code?: string) {
		super(message);
		this.name = "ApiError";
		this.status = status;
		this.data = data;
		this.code = code;
	}
}

function extractApiErrorCode(parsed: unknown): string | undefined {
	if (
		parsed &&
		typeof parsed === "object" &&
		"error" in parsed &&
		parsed.error &&
		typeof parsed.error === "object" &&
		"code" in parsed.error &&
		typeof parsed.error.code === "string"
	) {
		return parsed.error.code;
	}

	if (parsed && typeof parsed === "object" && "code" in parsed && typeof parsed.code === "string") {
		return parsed.code;
	}

	return undefined;
}

function extractApiErrorMessage(parsed: unknown, fallback: string): string {
	if (typeof parsed === "string" && parsed.trim()) {
		return parsed;
	}

	if (
		parsed &&
		typeof parsed === "object" &&
		"error" in parsed &&
		parsed.error &&
		typeof parsed.error === "object" &&
		"message" in parsed.error &&
		typeof parsed.error.message === "string"
	) {
		return parsed.error.message;
	}

	if (
		parsed &&
		typeof parsed === "object" &&
		"error" in parsed &&
		typeof parsed.error === "string"
	) {
		return parsed.error;
	}

	if (
		parsed &&
		typeof parsed === "object" &&
		"message" in parsed &&
		typeof parsed.message === "string"
	) {
		return parsed.message;
	}

	if (
		parsed &&
		typeof parsed === "object" &&
		"details" in parsed &&
		Array.isArray(parsed.details)
	) {
		const firstDetail = parsed.details[0];
		if (
			firstDetail &&
			typeof firstDetail === "object" &&
			"message" in firstDetail &&
			typeof firstDetail.message === "string" &&
			firstDetail.message.trim()
		) {
			return firstDetail.message;
		}
	}

	return fallback;
}

async function readApiErrorData(response: Response): Promise<unknown> {
	let bodyText: string;

	try {
		bodyText = await response.clone().text();
	} catch {
		return undefined;
	}

	if (!bodyText.trim()) {
		return undefined;
	}

	try {
		return JSON.parse(bodyText);
	} catch {
		return bodyText;
	}
}

function isBodyInit(value: BodyInit | object): value is BodyInit {
	return (
		typeof value === "string" ||
		value instanceof Blob ||
		value instanceof FormData ||
		value instanceof URLSearchParams ||
		value instanceof ArrayBuffer ||
		value instanceof ReadableStream ||
		ArrayBuffer.isView(value)
	);
}

/**
 * A wrapper around the native fetch function to automatically handle
 * API base URL, credentials, CSRF tokens, and object stringification.
 *
 * @param path The API endpoint path (e.g., '/auth/me').
 * @param options Custom fetch options extending RequestInit.
 * @returns The fetch Promise.
 */
async function performFetch(path: string, options: FetchApiOptions = {}): Promise<Response> {
	const url = `${API_BASE_URL}${path}`;
	const { timeoutMs, ...restOptions } = options;

	const defaultHeaders = new Headers(restOptions.headers);

	const isFormData = restOptions.body instanceof FormData;

	if (!isFormData && !defaultHeaders.has("Content-Type")) {
		defaultHeaders.set("Content-Type", "application/json");
	}

	const method = restOptions.method?.toUpperCase() || "GET";

	if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
		const csrfToken = getCookie("_csrf");
		if (csrfToken) {
			defaultHeaders.set("X-CSRF-Token", csrfToken);
		}
	}

	const resolvedTimeout =
		timeoutMs === null || timeoutMs === 0 ? null : (timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS);
	let timeoutId: ReturnType<typeof setTimeout> | null = null;

	const fetchOptions: RequestInit = {
		...restOptions,
		headers: defaultHeaders,
		credentials: "include",
		body: undefined,
	};

	if (!restOptions.signal && resolvedTimeout !== null) {
		const controller = new AbortController();
		fetchOptions.signal = controller.signal;
		timeoutId = setTimeout(() => controller.abort(), resolvedTimeout);
	}

	if (restOptions.body !== null && restOptions.body !== undefined) {
		if (isBodyInit(restOptions.body)) {
			fetchOptions.body = restOptions.body;
		} else if (typeof restOptions.body === "object") {
			fetchOptions.body = JSON.stringify(restOptions.body);
		}
	}

	try {
		return await fetch(url, fetchOptions);
	} finally {
		if (timeoutId) {
			clearTimeout(timeoutId);
		}
	}
}

export async function fetchApi(path: string, options: FetchApiOptions = {}): Promise<Response> {
	return performFetch(path, options);
}

export async function createApiErrorFromResponse(
	response: Response,
	fallback = response.statusText || "Request failed",
): Promise<ApiError> {
	const parsed = await readApiErrorData(response);
	const message = extractApiErrorMessage(parsed, fallback);

	return new ApiError(message, response.status, parsed, extractApiErrorCode(parsed));
}

/**
 * Fetch wrapper that throws ApiError on non-2xx responses and attempts to parse
 * a JSON error body when available.
 */
export async function fetchApiOrThrow(
	path: string,
	options: FetchApiOptions = {},
): Promise<Response> {
	const response = await performFetch(path, options);
	if (response.ok) {
		return response;
	}

	const error = await createApiErrorFromResponse(response);
	throw error;
}

export async function returnFetchedData<T>(response: Response): Promise<T> {
	try {
		const data: T = await response.json();

		const responseData =
			data && typeof data === "object" && data !== null && "data" in data
				? (data as { data: T })["data"]
				: data;

		return responseData;
	} catch {
		throw new Error("Failed to parse response JSON");
	}
}
