import type { ChatCompletionParameters } from "~/types";

const DEFAULT_AI_GATEWAY_CACHE_TTL_SECONDS = 60 * 60 * 24;

type AiGatewayMetadataSource = Pick<
	ChatCompletionParameters,
	"user" | "platform" | "completion_id"
>;

export function getAiGatewayMetadataHeaders(
	params: AiGatewayMetadataSource,
): Record<string, string | unknown> {
	return {
		email: params.user?.email,
		userId: params.user?.id,
		platform: params.platform,
		completionId: params.completion_id,
	};
}

export function resolveAiGatewayCacheTtl(
	params?: ChatCompletionParameters,
): number {
	const ttl = params?.options?.cache_ttl_seconds;

	if (typeof ttl === "number" && Number.isFinite(ttl) && ttl >= 0) {
		return Math.floor(ttl);
	}

	return DEFAULT_AI_GATEWAY_CACHE_TTL_SECONDS;
}
