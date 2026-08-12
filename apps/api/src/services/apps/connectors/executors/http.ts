import { AssistantError, ErrorType } from "~/utils/errors";
import { safeParseJson } from "~/utils/json";
import { redactSensitiveTokens } from "~/utils/redaction";

function parseConnectorApiBaseUrl(rawUrl: string): URL {
	let url: URL;
	try {
		url = new URL(rawUrl);
	} catch {
		throw new AssistantError("Connector API URL is invalid", ErrorType.PARAMS_ERROR, 400);
	}

	if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
		throw new AssistantError("Connector API URL is not supported", ErrorType.PARAMS_ERROR, 400);
	}
	return url;
}

function getConnectorErrorType(status: number): ErrorType {
	if (status === 400 || status === 422) {
		return ErrorType.PARAMS_ERROR;
	}

	return ErrorType.EXTERNAL_API_ERROR;
}

function getConnectorErrorStatus(status: number): number {
	if (status === 400 || status === 422) {
		return 400;
	}

	return 502;
}

interface ConnectorJsonRequest {
	path: string;
	token: string;
	method?: string;
	headers?: Record<string, string>;
	body?: unknown;
	allowNullResponse?: boolean;
}

export function createConnectorJsonClient(baseUrl: string) {
	const base = parseConnectorApiBaseUrl(baseUrl);
	return async (params: ConnectorJsonRequest) => {
		if (!params.path.startsWith("/") || params.path.startsWith("//")) {
			throw new AssistantError("Connector API path is invalid", ErrorType.PARAMS_ERROR, 400);
		}
		const url = new URL(params.path, `${base.origin}/`);
		if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname.replace(/\/$/, ""))) {
			throw new AssistantError("Connector API path is not supported", ErrorType.PARAMS_ERROR, 400);
		}
		const response = await fetch(url, {
			method: params.method ?? "GET",
			headers: {
				Authorization: `Bearer ${params.token}`,
				Accept: "application/json",
				...(params.body ? { "Content-Type": "application/json" } : {}),
				...params.headers,
			},
			body: params.body ? JSON.stringify(params.body) : undefined,
		});

		const text = await response.text();
		const data = text.trim() ? safeParseJson(text) : {};
		if (!response.ok) {
			const redactedText = redactSensitiveTokens(text);
			throw new AssistantError(
				`Connector API request failed (${response.status}): ${redactedText.slice(0, 300)}`,
				getConnectorErrorType(response.status),
				getConnectorErrorStatus(response.status),
			);
		}

		if (data === null && params.allowNullResponse) {
			return data;
		}

		if (!data) {
			throw new AssistantError(
				"Connector API returned invalid JSON",
				ErrorType.EXTERNAL_API_ERROR,
				502,
			);
		}

		return data;
	};
}
