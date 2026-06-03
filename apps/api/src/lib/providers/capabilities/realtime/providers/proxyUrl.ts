import { AssistantError, ErrorType } from "~/utils/errors";

export function buildRealtimeProxyUrl({
	apiBaseUrl,
	path,
	params,
}: {
	apiBaseUrl?: string;
	path: string;
	params?: Record<string, string | undefined>;
}): string {
	if (!apiBaseUrl) {
		throw new AssistantError("Missing API base URL", ErrorType.CONFIGURATION_ERROR);
	}

	const url = new URL(path, apiBaseUrl);
	if (url.protocol === "http:") {
		url.protocol = "ws:";
	} else if (url.protocol === "https:") {
		url.protocol = "wss:";
	}

	for (const [key, value] of Object.entries(params ?? {})) {
		if (value) {
			url.searchParams.set(key, value);
		}
	}

	return url.toString();
}
