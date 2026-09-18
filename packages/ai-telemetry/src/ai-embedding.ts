import { buildAiEmbeddingProperties } from "./ai-embedding-properties.js";
import { AI_EMBEDDING_EVENT_NAME, AI_OBSERVABILITY_EVENT_CATEGORY } from "./constants.js";
import type {
  AiErrorInfo,
  TelemetryEvent,
  TelemetryPersonProperties,
  TelemetryProperties,
} from "./types.js";

export type AiEmbeddingEventInput = {
  distinctId: string;
  personProperties?: TelemetryPersonProperties;
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

export function buildAiEmbeddingEvent(input: AiEmbeddingEventInput): TelemetryEvent {
  return {
    name: AI_EMBEDDING_EVENT_NAME,
    category: AI_OBSERVABILITY_EVENT_CATEGORY,
    distinctId: input.distinctId,
    personProperties: input.personProperties,
    properties: buildAiEmbeddingProperties(input),
  };
}
