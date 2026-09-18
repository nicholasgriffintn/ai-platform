import { millisecondsToSeconds } from "@ngriffin_uk/polychat-utility-core";
import { omitNullishValues } from "@ngriffin_uk/polychat-utility-server/objects";

import type { AiErrorInfo, TelemetryMessage, TelemetryProperties } from "./types.js";
import { normaliseTokenUsage } from "./usage/token-usage.js";

type AiGenerationPropertiesInput = {
  traceId: string;
  sessionId?: string;
  spanId?: string;
  spanName?: string;
  parentSpanId?: string;
  model?: string;
  provider?: string;
  input?: TelemetryMessage[];
  output?: TelemetryMessage;
  usage?: Record<string, unknown>;
  latencyMs?: number;
  timeToFirstTokenMs?: number;
  stream?: boolean;
  stopReason?: string;
  httpStatus?: number;
  tools?: string[];
  toolsCalled?: string[];
  temperature?: number;
  maxTokens?: number;
  error?: AiErrorInfo;
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
  const toolsCalled = input.toolsCalled?.length ? input.toolsCalled : undefined;

  return {
    ...omitNullishValues({
      $ai_trace_id: input.traceId,
      $ai_session_id: input.sessionId,
      $ai_span_id: input.spanId,
      $ai_span_name: input.spanName,
      $ai_parent_id: input.parentSpanId,
      $ai_model: input.model || "unknown",
      $ai_provider: input.provider || "unknown",
      $ai_input_tokens: usage?.input_tokens,
      $ai_output_tokens: usage?.output_tokens,
      $ai_cache_read_input_tokens: usage?.cached_input_tokens,
      $ai_cache_creation_input_tokens: usage?.cache_creation_tokens,
      $ai_reasoning_tokens: usage?.reasoning_tokens,
      $ai_latency: millisecondsToSeconds(input.latencyMs),
      $ai_time_to_first_token: millisecondsToSeconds(input.timeToFirstTokenMs),
      $ai_http_status: input.httpStatus,
      $ai_stream: input.stream ?? false,
      $ai_stop_reason: input.stopReason,
      $ai_tools: input.tools?.length ? input.tools : undefined,
      $ai_tools_called: toolsCalled,
      $ai_tool_call_count: toolsCalled?.length,
      $ai_temperature: input.temperature,
      $ai_max_tokens: input.maxTokens,
      $ai_is_error: input.error ? true : undefined,
      $ai_error: input.error?.message,
    }),
    ...omitNullishValues({
      $ai_input: input.captureContent ? input.input : undefined,
      $ai_output_choices: input.captureContent ? outputChoices : undefined,
    }),
    ...input.properties,
  };
}
