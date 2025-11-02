import { API_BASE_URL } from "~/constants";

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
};

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

	const defaultHeaders: Record<string, string> = {
		...(options.headers as Record<string, string>),
	};

	const isFormData = options.body instanceof FormData;

	if (!isFormData && !defaultHeaders["Content-Type"]) {
		defaultHeaders["Content-Type"] = "application/json";
	}

	const method = options.method?.toUpperCase() || "GET";

	if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
		const csrfToken = getCookie("_csrf");
		if (csrfToken) {
			defaultHeaders["X-CSRF-Token"] = csrfToken;
		}
	}

	const fetchOptions: RequestInit = {
		...options,
		headers: defaultHeaders,
		credentials: "include",
		body: undefined,
	};

	if (options.body !== null && options.body !== undefined) {
		if (
			typeof options.body === "string" ||
			options.body instanceof Blob ||
			options.body instanceof FormData ||
			options.body instanceof URLSearchParams ||
			options.body instanceof ArrayBuffer ||
			options.body instanceof ReadableStream ||
			ArrayBuffer.isView(options.body)
		) {
			fetchOptions.body = options.body as BodyInit;
		} else if (typeof options.body === "object") {
			fetchOptions.body = JSON.stringify(options.body);
		}
	}

	return fetch(url, fetchOptions);
}

export async function fetchApi(
	path: string,
	options: FetchApiOptions = {},
): Promise<Response> {
	let response = await performFetch(path, options);

	return response;
}
