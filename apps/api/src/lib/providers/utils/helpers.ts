import type { ChatCompletionParameters } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import {
	getAiGatewayMetadataHeaders,
	resolveAiGatewayCacheTtl,
} from "~/utils/aiGateway";

/**
 * Validates that AI_GATEWAY_TOKEN is present in the environment
 * @param params - The chat completion parameters
 * @throws AssistantError if AI_GATEWAY_TOKEN is missing
 */
export function validateAiGatewayToken(params: ChatCompletionParameters): void {
	if (!params.env.AI_GATEWAY_TOKEN) {
		throw new AssistantError(
			"Missing AI_GATEWAY_TOKEN",
			ErrorType.CONFIGURATION_ERROR,
		);
	}
}

/**
 * Builds standard Cloudflare AI Gateway headers
 * @param params - The chat completion parameters
 * @param apiKey - The provider API key
 * @returns Headers object with AI Gateway configuration
 */
export function buildAiGatewayHeaders(
	params: ChatCompletionParameters,
	apiKey: string,
): Record<string, string> {
	return {
		"cf-aig-authorization": params.env.AI_GATEWAY_TOKEN || "",
		Authorization: `Bearer ${apiKey}`,
		"Content-Type": "application/json",
		"cf-aig-metadata": JSON.stringify(getAiGatewayMetadataHeaders(params)),
		"cf-aig-cache-ttl": resolveAiGatewayCacheTtl(params).toString(),
	};
}

/**
 * Builds the settings object used for provider metrics tracking
 * @param params - The chat completion parameters
 * @returns Settings object for analytics
 */
export function buildMetricsSettings(
	params: ChatCompletionParameters,
): Record<string, any> {
	return {
		temperature: params.temperature,
		max_tokens: params.max_tokens,
		top_p: params.top_p,
		top_k: params.top_k,
		seed: params.seed,
		repetition_penalty: params.repetition_penalty,
		frequency_penalty: params.frequency_penalty,
		presence_penalty: params.presence_penalty,
	};
}

/**
 * Parses delimited credentials string into component parts
 * @param credentialString - The delimited credential string
 * @param delimiter - The delimiter used (default: "::@@::")
 * @param expectedParts - Number of expected parts
 * @param errorMessage - Custom error message for validation failure
 * @returns Array of credential parts
 * @throws AssistantError if parsing fails
 */
export function parseDelimitedCredentials(
	credentialString: string,
	delimiter = "::@@::",
	expectedParts: number,
	errorMessage = "Invalid credentials format",
): string[] {
	const parts = credentialString.split(delimiter);

	if (parts.length !== expectedParts) {
		throw new AssistantError(errorMessage, ErrorType.CONFIGURATION_ERROR);
	}

	return parts;
}

/**
 * Safely parses JSON from a response with error handling
 * @param response - The fetch response
 * @param context - Context for error logging (e.g., provider name)
 * @returns Parsed JSON data
 * @throws AssistantError if parsing fails
 */
export async function safeParseJSON<T = any>(
	response: Response,
	context: string,
): Promise<T> {
	try {
		return (await response.json()) as T;
	} catch (jsonError) {
		const responseText = await response.text().catch(() => "[unable to read]");
		throw new AssistantError(
			`${context} returned invalid JSON response: ${jsonError instanceof Error ? jsonError.message : "Unknown JSON parse error"}`,
			ErrorType.PROVIDER_ERROR,
			500,
			{
				responsePreview: responseText.substring(0, 200),
				originalError: jsonError,
			},
		);
	}
}

/**
 * Normalizes async operation status strings to standard values
 * @param status - Raw status string from provider
 * @returns Normalized status
 */
export function normalizeAsyncStatus(
	status: string | undefined,
): "in_progress" | "completed" | "failed" {
	if (!status) return "in_progress";

	const normalized = status.toString().toUpperCase();

	if (
		normalized === "SUCCEEDED" ||
		normalized === "SUCCESS" ||
		normalized === "COMPLETED"
	) {
		return "completed";
	}

	if (
		normalized === "FAILED" ||
		normalized === "ERROR" ||
		normalized === "CANCELLED" ||
		normalized === "TIMED_OUT"
	) {
		return "failed";
	}

	return "in_progress";
}
