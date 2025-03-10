import { gatewayId } from "../constants/app";
import { availableFunctions } from "../services/functions";
import type { IEnv } from "../types";
import { AssistantError, ErrorType } from "../utils/errors";

export async function fetchAIResponse(
	provider: string,
	endpointOrUrl: string,
	headers: Record<string, string>,
	body: Record<string, any>,
	env?: IEnv,
	options: {
		requestTimeout?: number;
		retryDelay?: number;
		maxAttempts?: number;
		backoff?: "exponential" | "linear";
	} = {
		requestTimeout: 100000,
		retryDelay: 500,
		maxAttempts: 2,
		backoff: "exponential",
	},
) {
	const isUrl = endpointOrUrl.startsWith("http");

	const tools = provider === "tool-use" ? availableFunctions : undefined;
	const bodyWithTools = tools ? { ...body, tools } : body;

	let response;
	if (!isUrl) {
		if (!env?.AI) {
			throw new AssistantError(
				"AI binding is required to fetch gateway responses",
				ErrorType.PARAMS_ERROR,
			);
		}

		const gateway = env.AI.gateway(gatewayId);

		response = await gateway.run({
			provider: provider,
			endpoint: endpointOrUrl,
			headers: headers,
			query: bodyWithTools,
			// @ts-expect-error - types seem to be wrong
			config: {
				requestTimeout: options.requestTimeout,
				maxAttempts: options.maxAttempts,
				retryDelay: options.retryDelay,
				backoff: options.backoff,
			},
		});
	} else {
		response = await fetch(endpointOrUrl, {
			method: "POST",
			headers,
			body: JSON.stringify(bodyWithTools),
		});
	}

	if (!response.ok) {
		console.error(await response.text());
		throw new AssistantError(
			`Failed to get response for ${provider} from ${endpointOrUrl}`,
		);
	}

	const data = (await response.json()) as Record<string, any>;

	const eventId = response.headers.get("cf-aig-event-id");
	const logId = response.headers.get("cf-aig-log-id");
	const cacheStatus = response.headers.get("cf-aig-cache-status");

	return { ...data, eventId, logId, cacheStatus };
}
