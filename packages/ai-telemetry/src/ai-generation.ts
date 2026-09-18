import { buildAiGenerationProperties } from "./ai-generation-properties.js";
import { AI_GENERATION_EVENT_NAME, AI_OBSERVABILITY_EVENT_CATEGORY } from "./constants.js";
import type {
  AiErrorInfo,
  TelemetryEvent,
  TelemetryMessage,
  TelemetryPersonProperties,
  TelemetryProperties,
} from "./types.js";

export type AiGenerationEventInput = {
  distinctId: string;
  personProperties?: TelemetryPersonProperties;
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

export function buildAiGenerationEvent(input: AiGenerationEventInput): TelemetryEvent {
  return {
    name: AI_GENERATION_EVENT_NAME,
    category: AI_OBSERVABILITY_EVENT_CATEGORY,
    distinctId: input.distinctId,
    personProperties: input.personProperties,
    properties: buildAiGenerationProperties(input),
  };
}
