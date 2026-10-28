import { omitNullishValues } from "@ngriffin_uk/polychat-utility-server/objects";

import type {
  ResolvedAiEmbedding,
  ResolvedAiFeedback,
  ResolvedAiGeneration,
  TelemetrySink,
} from "../types.js";
import { normaliseTokenUsage } from "../usage/token-usage.js";

const SPAN_STATUS_ERROR = 2;

export type SentrySpanAttributes = Record<string, string | number | boolean>;

export interface SentryTelemetrySpan {
  setStatus(status: { code: number; message?: string }): unknown;
  end(endTimestamp?: number): void;
}

export interface SentryTelemetryClient {
  getActiveSpan(): { isRecording(): boolean } | undefined;
  startInactiveSpan(options: {
    name: string;
    op: string;
    startTime: number;
    forceTransaction: boolean;
    attributes: SentrySpanAttributes;
  }): SentryTelemetrySpan;
  captureFeedback(feedback: {
    message: string;
    source: string;
    tags: Record<string, string>;
  }): string;
}

function recordAiSpan(
  client: SentryTelemetryClient,
  endTime: number,
  span: {
    name: string;
    op: string;
    latencyMs?: number;
    error?: { message: string };
    attributes: Record<string, string | number | boolean | undefined>;
  },
): void {
  const active = client.startInactiveSpan({
    name: span.name,
    op: span.op,
    startTime: endTime - (span.latencyMs ?? 0),
    forceTransaction: client.getActiveSpan()?.isRecording() !== true,
    attributes: omitNullishValues(span.attributes),
  });

  if (span.error) {
    active.setStatus({ code: SPAN_STATUS_ERROR, message: span.error.message });
  }

  active.end(endTime);
}

export function createSentrySink(
  client: SentryTelemetryClient | undefined,
  now: () => number = Date.now,
): TelemetrySink | null {
  if (!client) {
    return null;
  }

  return {
    name: "sentry",
    captureAiGeneration(signal: ResolvedAiGeneration) {
      const usage = normaliseTokenUsage(signal.usage);
      const model = signal.model || "unknown";

      recordAiSpan(client, now(), {
        name: `chat ${model}`,
        op: "gen_ai.chat",
        latencyMs: signal.latencyMs,
        error: signal.error,
        attributes: {
          "gen_ai.operation.name": "chat",
          "gen_ai.system": signal.provider || "unknown",
          "gen_ai.request.model": model,
          "gen_ai.request.stream": signal.stream ?? false,
          "gen_ai.request.temperature": signal.temperature,
          "gen_ai.request.max_tokens": signal.maxTokens,
          "gen_ai.request.available_tools": signal.tools?.length
            ? JSON.stringify(signal.tools)
            : undefined,
          "gen_ai.response.finish_reasons": signal.stopReason
            ? JSON.stringify([signal.stopReason])
            : undefined,
          "gen_ai.usage.input_tokens": usage?.input_tokens,
          "gen_ai.usage.output_tokens": usage?.output_tokens,
          "gen_ai.usage.total_tokens": usage?.total_tokens,
          "gen_ai.usage.input_tokens.cached": usage?.cached_input_tokens,
          "gen_ai.usage.input_tokens.cache_write": usage?.cache_creation_tokens,
          "gen_ai.usage.output_tokens.reasoning": usage?.reasoning_tokens,
          "gen_ai.input.messages":
            signal.captureContent && signal.input ? JSON.stringify(signal.input) : undefined,
          "gen_ai.output.messages":
            signal.captureContent && signal.output ? JSON.stringify([signal.output]) : undefined,
          "http.response.status_code": signal.httpStatus,
          "polychat.trace_id": signal.traceId,
          "polychat.session_id": signal.sessionId,
          "polychat.span_name": signal.spanName,
          "polychat.time_to_first_token_ms": signal.timeToFirstTokenMs,
          "polychat.tools_called": signal.toolsCalled?.length
            ? JSON.stringify(signal.toolsCalled)
            : undefined,
        },
      });
    },
    captureAiEmbedding(signal: ResolvedAiEmbedding) {
      const model = signal.model || "unknown";

      recordAiSpan(client, now(), {
        name: `embeddings ${model}`,
        op: "gen_ai.embeddings",
        latencyMs: signal.latencyMs,
        error: signal.error,
        attributes: {
          "gen_ai.operation.name": "embeddings",
          "gen_ai.system": signal.provider || "unknown",
          "gen_ai.request.model": model,
          "gen_ai.usage.input_tokens": signal.inputTokens,
          "gen_ai.embeddings.input":
            signal.captureContent && signal.input !== undefined
              ? JSON.stringify(signal.input)
              : undefined,
          "http.response.status_code": signal.httpStatus,
          "polychat.trace_id": signal.traceId,
          "polychat.session_id": signal.sessionId,
          "polychat.span_name": signal.spanName,
        },
      });
    },
    captureAiFeedback(feedback: ResolvedAiFeedback) {
      const rating = feedback.feedback === 1 ? "positive" : "negative";

      client.captureFeedback({
        message: `${rating === "positive" ? "Positive" : "Negative"} response feedback`,
        source: "ai_response",
        tags: omitNullishValues({
          ai_feedback: rating,
          ai_trace_id: feedback.traceId,
          distinct_id: feedback.distinctId,
          log_id: feedback.logId,
          message_id: feedback.messageId,
          conversation_id: feedback.conversationId,
        }),
      });
    },
  };
}
