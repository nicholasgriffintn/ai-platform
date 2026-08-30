import type { ChatCompletionParameters, IUser } from "~/types";
import { omitNullishValues } from "~/utils/objects";

const DEFAULT_AI_GATEWAY_CACHE_TTL_SECONDS = 60 * 60 * 24;

type AiGatewayMetadataSource = {
  context?: ChatCompletionParameters["context"];
  user?: Pick<IUser, "email" | "id">;
  platform?: ChatCompletionParameters["platform"];
  completion_id?: ChatCompletionParameters["completion_id"];
  locked?: ChatCompletionParameters["locked"];
};

type AiGatewayCacheTtlSource = Pick<ChatCompletionParameters, "cache_ttl_seconds"> & {
  locked?: ChatCompletionParameters["locked"];
};

type AiGatewayMetadataValue = string | number | bigint | boolean;

export function getAiGatewayMetadataHeaders(
  params: AiGatewayMetadataSource,
): Record<string, AiGatewayMetadataValue> {
  if (params.locked) {
    return {};
  }

  const metadata: Record<string, AiGatewayMetadataValue | null | undefined> = {
    email: params.context?.user?.email ?? params.user?.email,
    userId: params.context?.user?.id ?? params.user?.id,
    platform: params.platform,
    completionId: params.completion_id,
  };

  return omitNullishValues(metadata);
}

export function resolveAiGatewayCacheTtl(params?: AiGatewayCacheTtlSource): number {
  if (params?.locked) {
    return 0;
  }

  const ttl = params?.cache_ttl_seconds;

  if (typeof ttl === "number" && Number.isFinite(ttl) && ttl >= 0) {
    return Math.floor(ttl);
  }

  return DEFAULT_AI_GATEWAY_CACHE_TTL_SECONDS;
}

export function shouldCollectAiGatewayLog(params?: { locked?: boolean }): boolean {
  return params?.locked !== true;
}

export function buildAiGatewayControlHeaders(
  params: AiGatewayMetadataSource & AiGatewayCacheTtlSource,
): Record<string, string> {
  return {
    "cf-aig-metadata": JSON.stringify(getAiGatewayMetadataHeaders(params)),
    "cf-aig-cache-ttl": resolveAiGatewayCacheTtl(params).toString(),
    "cf-aig-collect-log": shouldCollectAiGatewayLog(params) ? "true" : "false",
  };
}
