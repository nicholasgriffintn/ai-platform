import { AssistantError, ErrorType } from "~/utils/errors";
import { safeParseJson } from "~/utils/json";
import { redactSensitiveTokens } from "~/utils/redaction";

const CONNECTOR_API_HOSTS = new Set([
	"app.asana.com",
	"api.linear.app",
	"api.notion.com",
	"api.ouraring.com",
	"api.todoist.com",
	"api.vercel.com",
	"api.fitbit.com",
	"api.netlify.com",
	"gmail.googleapis.com",
	"graph.microsoft.com",
	"app.posthog.com",
	"eu.posthog.com",
	"us.posthog.com",
	"sentry.io",
	"wbsapi.withings.net",
	"www.googleapis.com",
]);

function assertConnectorApiUrl(rawUrl: string): string {
	let url: URL;
	try {
		url = new URL(rawUrl);
	} catch {
		throw new AssistantError("Connector API URL is invalid", ErrorType.PARAMS_ERROR, 400);
	}

	if (
		url.protocol !== "https:" ||
		url.username ||
		url.password ||
		!CONNECTOR_API_HOSTS.has(url.hostname)
	) {
		throw new AssistantError("Connector API URL is not supported", ErrorType.PARAMS_ERROR, 400);
	}

	return url.toString();
}

export async function fetchConnectorJson(params: {
	url: string;
	token: string;
	method?: string;
	headers?: Record<string, string>;
	body?: unknown;
	allowNullResponse?: boolean;
}) {
	const url = assertConnectorApiUrl(params.url);
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
			ErrorType.EXTERNAL_API_ERROR,
			502,
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
}
