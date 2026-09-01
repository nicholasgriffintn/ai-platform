import { isRecord } from "~/utils/objects";

import { hasRecognisedTokenFields } from "./tokenUsage";

const BEDROCK_INVOCATION_METRICS = "amazon-bedrock-invocationMetrics";

function candidatePayloads(data: Record<string, unknown>): unknown[] {
  const message = isRecord(data.message) ? data.message : undefined;
  const response = isRecord(data.response) ? data.response : undefined;
  const delta = isRecord(data.delta) ? data.delta : undefined;
  const metadata = isRecord(data.metadata) ? data.metadata : undefined;
  const groq = isRecord(data.x_groq) ? data.x_groq : undefined;

  return [
    data.usage,
    data.usageMetadata,
    message?.usage,
    message?.usageMetadata,
    response?.usage,
    response?.usageMetadata,
    delta?.usage,
    metadata?.usage,
    metadata?.usageMetadata,
    groq?.usage,
    data[BEDROCK_INVOCATION_METRICS],
    data,
  ];
}

export function extractUsagePayload(data: unknown): Record<string, unknown> | null {
  if (!isRecord(data)) {
    return null;
  }

  for (const candidate of candidatePayloads(data)) {
    if (hasRecognisedTokenFields(candidate)) {
      return candidate as Record<string, unknown>;
    }
  }

  return null;
}

export function extractPredictionMetricsPayload(data: unknown): Record<string, unknown> | null {
  if (!isRecord(data) || !isRecord(data.metrics)) {
    return null;
  }

  return { metrics: data.metrics };
}

export function readServiceTier(data: unknown): string | undefined {
  if (!isRecord(data)) {
    return undefined;
  }

  if (typeof data.service_tier === "string" && data.service_tier) {
    return data.service_tier;
  }

  const response = isRecord(data.response) ? data.response : undefined;

  return typeof response?.service_tier === "string" && response.service_tier
    ? response.service_tier
    : undefined;
}
