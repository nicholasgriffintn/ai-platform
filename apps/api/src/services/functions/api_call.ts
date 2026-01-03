import type { ConversationManager } from "~/lib/conversationManager";
import type { IFunction, IRequest } from "~/types";
import { getLogger } from "~/utils/logger";
import { safeParseJson } from "~/utils/json";

const logger = getLogger({ prefix: "services/functions/api_call" });

const DEFAULT_TIMEOUT_MS = 15000;
const MAX_TIMEOUT_MS = 60000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const isPrivateHostname = (hostname: string): boolean => {
	const normalized = hostname.toLowerCase();
	if (
		normalized === "localhost" ||
		normalized.endsWith(".local") ||
		normalized.endsWith(".internal")
	) {
		return true;
	}

	if (normalized.includes(":")) {
		return (
			normalized === "::1" ||
			normalized.startsWith("fe80:") ||
			normalized.startsWith("fc") ||
			normalized.startsWith("fd")
		);
	}

	const ipv4Match = normalized.match(
		/^(?<a>\d{1,3})\.(?<b>\d{1,3})\.(?<c>\d{1,3})\.(?<d>\d{1,3})$/,
	);
	if (!ipv4Match || !ipv4Match.groups) {
		return false;
	}

	const parts = [
		ipv4Match.groups.a,
		ipv4Match.groups.b,
		ipv4Match.groups.c,
		ipv4Match.groups.d,
	].map((value) => Number.parseInt(value, 10));

	if (parts.some((value) => Number.isNaN(value) || value > 255 || value < 0)) {
		return true;
	}

	const [a, b] = parts;
	if (a === 10 || a === 127 || a === 0) return true;
	if (a === 169 && b === 254) return true;
	if (a === 192 && b === 168) return true;
	if (a === 172 && b >= 16 && b <= 31) return true;
	if (a === 100 && b >= 64 && b <= 127) return true;

	return false;
};

const normalizeHeaders = (headers: unknown): Record<string, string> => {
	if (!isRecord(headers)) {
		return {};
	}

	return Object.fromEntries(
		Object.entries(headers)
			.filter(([, value]) => value !== undefined && value !== null)
			.map(([key, value]) => [key, String(value)]),
	);
};

const appendQueryParams = (
	baseUrl: URL,
	params: Record<string, unknown> | undefined,
): void => {
	if (!params) return;

	for (const [key, value] of Object.entries(params)) {
		if (value === undefined || value === null) {
			continue;
		}

		if (Array.isArray(value)) {
			for (const entry of value) {
				baseUrl.searchParams.append(key, String(entry));
			}
		} else {
			baseUrl.searchParams.set(key, String(value));
		}
	}
};

const readResponseBody = async (
	response: Response,
): Promise<{ parsed: unknown | null; raw: string }> => {
	const raw = await response.text();
	if (!raw) {
		return { parsed: null, raw };
	}

	const contentType = response.headers.get("content-type") || "";
	const shouldParseJson =
		contentType.includes("application/json") || contentType.includes("+json");

	if (shouldParseJson) {
		return { parsed: safeParseJson(raw), raw };
	}

	const parsed = safeParseJson(raw);
	return { parsed, raw };
};

export const call_api: IFunction = {
	name: "call_api",
	description:
		"Calls a REST or GraphQL API and returns a structured response. Use this when you need to fetch data from external APIs.",
	type: "normal",
	costPerCall: 0,
	isDefault: true,
	parameters: {
		type: "object",
		properties: {
			request_type: {
				type: "string",
				description: "The request type: 'rest' or 'graphql'",
				enum: ["rest", "graphql"],
				default: "rest",
			},
			url: {
				type: "string",
				description: "The full URL of the API endpoint",
			},
			method: {
				type: "string",
				description:
					"HTTP method for REST requests (defaults to GET or POST when a body is supplied)",
				enum: ["GET", "POST", "PUT", "PATCH", "DELETE"],
			},
			headers: {
				type: "object",
				description:
					'Optional headers to include in the request (example: {"Authorization":"Bearer <token>","Accept":"application/json"})',
			},
			query_params: {
				type: "object",
				description:
					'Optional query parameters as key-value pairs (example: {"q":"search term","page":2})',
			},
			body: {
				type: "object",
				description:
					'JSON body for REST requests (example: {"id":123,"name":"Ada"})',
			},
			graphql_query: {
				type: "string",
				description: "GraphQL query string (required for graphql)",
			},
			graphql_variables: {
				type: "object",
				description: "GraphQL variables object (optional)",
			},
			graphql_operation_name: {
				type: "string",
				description: "GraphQL operation name (optional)",
			},
			timeout_ms: {
				type: "number",
				description: "Timeout in milliseconds (max 60000)",
				minimum: 1000,
			},
		},
		required: ["url"],
	},
	function: async (
		_completion_id: string,
		args: any,
		_req: IRequest,
		_app_url?: string,
		_conversationManager?: ConversationManager,
	) => {
		const urlInput = typeof args?.url === "string" ? args.url.trim() : "";
		if (!urlInput) {
			return {
				status: "error",
				name: "call_api",
				content: "Missing URL for API request",
				data: {},
			};
		}

		let url: URL;
		try {
			url = new URL(urlInput);
		} catch {
			return {
				status: "error",
				name: "call_api",
				content: "Invalid URL format",
				data: {},
			};
		}

		if (!["http:", "https:"].includes(url.protocol)) {
			return {
				status: "error",
				name: "call_api",
				content: "Only http and https URLs are supported",
				data: {},
			};
		}

		if (isPrivateHostname(url.hostname)) {
			return {
				status: "error",
				name: "call_api",
				content: "Private or local network URLs are not allowed",
				data: {},
			};
		}

		const requestType = args?.request_type === "graphql" ? "graphql" : "rest";
		const timeoutMsInput =
			typeof args?.timeout_ms === "number" ? args.timeout_ms : undefined;
		const timeoutMs =
			timeoutMsInput && timeoutMsInput > 0
				? Math.min(timeoutMsInput, MAX_TIMEOUT_MS)
				: DEFAULT_TIMEOUT_MS;

		const headers = normalizeHeaders(args?.headers);
		const queryParams = isRecord(args?.query_params)
			? (args.query_params as Record<string, unknown>)
			: undefined;

		appendQueryParams(url, queryParams);

		let method = "GET";
		let body: string | undefined;

		if (requestType === "graphql") {
			const graphqlQuery =
				typeof args?.graphql_query === "string"
					? args.graphql_query.trim()
					: "";
			if (!graphqlQuery) {
				return {
					status: "error",
					name: "call_api",
					content: "GraphQL requests require a graphql_query",
					data: {},
				};
			}

			method = "POST";
			const payload = {
				query: graphqlQuery,
				variables: isRecord(args?.graphql_variables)
					? args.graphql_variables
					: undefined,
				operationName:
					typeof args?.graphql_operation_name === "string"
						? args.graphql_operation_name
						: undefined,
			};
			body = JSON.stringify(payload);
			if (!headers["Content-Type"] && !headers["content-type"]) {
				headers["Content-Type"] = "application/json";
			}
		} else {
			const methodInput =
				typeof args?.method === "string"
					? args.method.toUpperCase()
					: undefined;
			const allowedMethods = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);
			method = allowedMethods.has(methodInput || "")
				? methodInput!
				: methodInput
					? ""
					: "GET";

			if (!method) {
				return {
					status: "error",
					name: "call_api",
					content: "Unsupported HTTP method",
					data: {},
				};
			}

			if (args?.body !== undefined && args?.body !== null) {
				if (method === "GET") {
					return {
						status: "error",
						name: "call_api",
						content: "GET requests do not support a body",
						data: {},
					};
				}

				if (typeof args.body === "string") {
					body = args.body;
				} else if (isRecord(args.body) || Array.isArray(args.body)) {
					body = JSON.stringify(args.body);
					if (!headers["Content-Type"] && !headers["content-type"]) {
						headers["Content-Type"] = "application/json";
					}
				} else {
					return {
						status: "error",
						name: "call_api",
						content: "Request body must be a string or JSON object",
						data: {},
					};
				}
			}
		}

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

		let response: Response;
		try {
			response = await fetch(url.toString(), {
				method,
				headers,
				body,
				signal: controller.signal,
			});
		} catch (error) {
			logger.error("API request failed", {
				error_message: error instanceof Error ? error.message : "Unknown error",
				url: url.toString(),
			});
			return {
				status: "error",
				name: "call_api",
				content:
					error instanceof Error && error.name === "AbortError"
						? "API request timed out"
						: "API request failed",
				data: {
					url: url.toString(),
					method,
				},
			};
		} finally {
			clearTimeout(timeoutId);
		}

		const headersMap: Record<string, string> = {};
		response.headers.forEach((value, key) => {
			headersMap[key] = value;
		});

		const { parsed, raw } = await readResponseBody(response);
		const hasJsonBody = parsed !== null;
		const responseBody = hasJsonBody ? parsed : raw;

		const graphqlErrors =
			requestType === "graphql" && isRecord(parsed) ? parsed.errors : undefined;

		const statusMessage =
			response.ok && graphqlErrors
				? "GraphQL request completed with errors"
				: response.ok
					? "API request completed"
					: `API request failed: ${response.status} ${response.statusText}`;

		return {
			status: response.ok ? "success" : "error",
			name: "call_api",
			content: statusMessage,
			data: {
				url: url.toString(),
				method,
				ok: response.ok,
				status: response.status,
				statusText: response.statusText,
				headers: headersMap,
				body: responseBody,
				body_format: hasJsonBody ? "json" : "text",
			},
		};
	},
};
