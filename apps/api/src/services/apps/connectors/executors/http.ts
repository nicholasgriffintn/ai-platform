import { AssistantError, ErrorType } from "~/utils/errors";
import { safeParseJson } from "~/utils/json";

export async function fetchConnectorJson(params: {
	url: string;
	token: string;
	method?: string;
	headers?: Record<string, string>;
	body?: unknown;
}) {
	const response = await fetch(params.url, {
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
		throw new AssistantError(
			`Connector API request failed (${response.status}): ${text.slice(0, 300)}`,
			ErrorType.EXTERNAL_API_ERROR,
			502,
		);
	}

	if (!data) {
		throw new AssistantError(
			"Connector API returned invalid JSON",
			ErrorType.EXTERNAL_API_ERROR,
			502,
		);
	}

	return data;
}
