import { omitNullishValues } from "@ngriffin_uk/polychat-utility-server/objects";

import type { TelemetryMessage, TelemetryProperties } from "./types.js";
import { normaliseTokenUsage } from "./usage/token-usage.js";

type AiGenerationPropertiesInput = {
  traceId: string;
  sessionId?: string;
  spanId?: string;
  spanName?: string;
  model?: string;
  provider?: string;
  input?: TelemetryMessage[];
  output?: TelemetryMessage;
  usage?: Record<string, unknown>;
  latencyMs?: number;
  stream?: boolean;
  captureContent: boolean;
  properties?: TelemetryProperties;
};

export function buildAiGenerationProperties(
  input: AiGenerationPropertiesInput,
): TelemetryProperties {
  const usage = normaliseTokenUsage(input.usage);
  const outputChoices = input.output
    ? [{ role: input.output.role, content: input.output.content }]
    : undefined;

  return {
    ...omitNullishValues({
      $ai_trace_id: input.traceId,
      $ai_session_id: input.sessionId,
      $ai_span_id: input.spanId,
      $ai_span_name: input.spanName,
      $ai_model: input.model || "unknown",
      $ai_provider: input.provider || "unknown",
      $ai_input_tokens: usage?.input_tokens,
      $ai_output_tokens: usage?.output_tokens,
      $ai_total_tokens: usage?.total_tokens,
      $ai_cache_read_input_tokens: usage?.cached_input_tokens,
      $ai_cache_creation_input_tokens: usage?.cache_creation_tokens,
      $ai_reasoning_tokens: usage?.reasoning_tokens,
      $ai_latency: typeof input.latencyMs === "number" ? input.latencyMs / 1000 : undefined,
      $ai_stream: input.stream ?? false,
    }),
    ...omitNullishValues({
      $ai_input: input.captureContent ? input.input : undefined,
      $ai_output_choices: input.captureContent ? outputChoices : undefined,
    }),
    ...input.properties,
  };
}
