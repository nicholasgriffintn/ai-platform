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
	body?: BodyInit | Record<string, any> | null;
	timeoutMs?: number | null;
};

export class ApiError extends Error {
	status: number;
	data?: unknown;

	constructor(message: string, status: number, data?: unknown) {
		super(message);
		this.name = "ApiError";
		this.status = status;
		this.data = data;
	}
}

/**
 * A wrapper around the native fetch function to automatically handle
 * API base URL, credentials, CSRF tokens, and object stringification.
 *
 * @param path The API endpoint path (e.g., '/auth/me').
 * @param options Custom fetch options extending RequestInit.
 * @returns The fetch Promise.
 */
async function performFetch(
	path: string,
	options: FetchApiOptions = {},
): Promise<Response> {
	const url = `${API_BASE_URL}${path}`;
	const { timeoutMs, ...restOptions } = options;

	const defaultHeaders: Record<string, string> = {
		...(restOptions.headers as Record<string, string>),
	};

	const isFormData = restOptions.body instanceof FormData;

	if (!isFormData && !defaultHeaders["Content-Type"]) {
		defaultHeaders["Content-Type"] = "application/json";
	}

	const method = restOptions.method?.toUpperCase() || "GET";

	if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
		const csrfToken = getCookie("_csrf");
		if (csrfToken) {
			defaultHeaders["X-CSRF-Token"] = csrfToken;
		}
	}

	const resolvedTimeout =
		timeoutMs === null || timeoutMs === 0
			? null
			: (timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS);
	let timeoutId: ReturnType<typeof setTimeout> | null = null;

	const fetchOptions: RequestInit = {
		...restOptions,
		headers: defaultHeaders,
		credentials: "include",
		body: undefined,
	};

	if (!restOptions.signal) {
		const controller = new AbortController();
		fetchOptions.signal = controller.signal;
		timeoutId = setTimeout(
			() => controller.abort(),
			resolvedTimeout ?? DEFAULT_FETCH_TIMEOUT_MS,
		);
	}

	if (restOptions.body !== null && restOptions.body !== undefined) {
		if (
			typeof restOptions.body === "string" ||
			restOptions.body instanceof Blob ||
			restOptions.body instanceof FormData ||
			restOptions.body instanceof URLSearchParams ||
			restOptions.body instanceof ArrayBuffer ||
			restOptions.body instanceof ReadableStream ||
			ArrayBuffer.isView(restOptions.body)
		) {
			fetchOptions.body = restOptions.body as BodyInit;
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

export async function fetchApi(
	path: string,
	options: FetchApiOptions = {},
): Promise<Response> {
	let response = await performFetch(path, options);

	return response;
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

	let parsed: unknown;
	try {
		parsed = await response.clone().json();
	} catch {
		parsed = undefined;
	}

	const message =
		parsed && typeof parsed === "object" && "error" in parsed && parsed.error
			? String((parsed as { error: string }).error)
			: response.statusText || "Request failed";

	throw new ApiError(message, response.status, parsed);
}

export async function returnFetchedData<T>(response: Response): Promise<T> {
	try {
		const data: T = await response.json();

		const responseData =
			data && typeof data === "object" && data !== null && "data" in data
				? (data as { data: T })["data"]
				: data;

		return responseData;
	} catch (error) {
		throw new Error("Failed to parse response JSON");
	}
}
