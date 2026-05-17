import type { ChatCompletionParameters } from "~/types";

const DEFAULT_AI_GATEWAY_CACHE_TTL_SECONDS = 60 * 60 * 24;

type AiGatewayMetadataSource = {
	user?: Pick<NonNullable<ChatCompletionParameters["user"]>, "email" | "id">;
	platform?: ChatCompletionParameters["platform"];
	completion_id?: ChatCompletionParameters["completion_id"];
};

type AiGatewayCacheTtlSource = Pick<ChatCompletionParameters, "options">;

type AiGatewayMetadataValue = string | number | bigint | boolean;

export function getAiGatewayMetadataHeaders(
	params: AiGatewayMetadataSource,
): Record<string, AiGatewayMetadataValue> {
	const metadata: Record<string, AiGatewayMetadataValue | null | undefined> = {
		email: params.user?.email,
		userId: params.user?.id,
		platform: params.platform,
		completionId: params.completion_id,
	};

	const headers: Record<string, AiGatewayMetadataValue> = {};

	for (const [key, value] of Object.entries(metadata)) {
		if (value !== undefined && value !== null) {
			headers[key] = value;
		}
	}

	return headers;
}

export function resolveAiGatewayCacheTtl(params?: AiGatewayCacheTtlSource): number {
	const ttl = params?.options?.cache_ttl_seconds;

	if (typeof ttl === "number" && Number.isFinite(ttl) && ttl >= 0) {
		return Math.floor(ttl);
	}

	return DEFAULT_AI_GATEWAY_CACHE_TTL_SECONDS;
}
