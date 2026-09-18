import { millisecondsToSeconds } from "@ngriffin_uk/polychat-utility-core";
import { omitNullishValues } from "@ngriffin_uk/polychat-utility-server/objects";

import type { AiErrorInfo, TelemetryProperties } from "./types.js";

type AiEmbeddingPropertiesInput = {
  traceId: string;
  sessionId?: string;
  spanId?: string;
  spanName?: string;
  parentSpanId?: string;
  model?: string;
  provider?: string;
  input?: string | string[];
  inputTokens?: number;
  latencyMs?: number;
  httpStatus?: number;
  error?: AiErrorInfo;
  captureContent: boolean;
  properties?: TelemetryProperties;
};

export function buildAiEmbeddingProperties(input: AiEmbeddingPropertiesInput): TelemetryProperties {
  return {
    ...omitNullishValues({
      $ai_trace_id: input.traceId,
      $ai_session_id: input.sessionId,
      $ai_span_id: input.spanId,
      $ai_span_name: input.spanName,
      $ai_parent_id: input.parentSpanId,
      $ai_model: input.model || "unknown",
      $ai_provider: input.provider || "unknown",
      $ai_input_tokens: input.inputTokens,
      $ai_latency: millisecondsToSeconds(input.latencyMs),
      $ai_http_status: input.httpStatus,
      $ai_is_error: input.error ? true : undefined,
      $ai_error: input.error?.message,
    }),
    ...omitNullishValues({
      $ai_input: input.captureContent ? input.input : undefined,
    }),
    ...input.properties,
  };
}
