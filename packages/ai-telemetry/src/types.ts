import type { ExecutionContext } from "@cloudflare/workers-types";
import type { AnalyticsEvent } from "@ngriffin_uk/polychat-schemas";

import type { SentryTelemetryClient } from "./sinks/sentry.js";

export type TelemetryProperties = Record<string, unknown>;

export type TelemetryPersonProperties = Record<
  string,
  string | number | boolean | null | undefined
>;

export type TelemetryEvent = Omit<AnalyticsEvent, "properties"> & {
  distinctId: string;
  personProperties?: TelemetryPersonProperties;
  properties?: TelemetryProperties;
};

export type TelemetryMetric = {
  traceId: string;
  timestamp: number;
  type: string;
  name: string;
  value: number;
  metadata: Record<string, unknown>;
  status: string;
  error?: string;
  distinctId?: string;
  personProperties?: TelemetryPersonProperties;
};

export type TelemetryLogLevel = "trace" | "debug" | "info" | "warn" | "error";

export type TelemetryLogRecord = {
  timestamp: number;
  level: TelemetryLogLevel;
  message: string;
  prefix?: string;
  attributes?: Record<string, unknown>;
  error?: Error;
  traceId?: string;
  spanId?: string;
};

export type TelemetrySpanStatus = "unset" | "ok" | "error";

export type TelemetrySpan = {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  startTime: number;
  endTime: number;
  status: TelemetrySpanStatus;
  statusMessage?: string;
  attributes: Record<string, unknown>;
};

export type TelemetryMessage = { role: string; content: unknown };

export type TelemetryIdentity = {
  user?: { id: number; email?: string | null; plan_id?: string | null } | null;
  anonymousUser?: { id: string } | null;
  userTrackingEnabled?: boolean | null;
};

export type TelemetryIdentityInput = {
  userId?: number | string | null;
  anonymousUserId?: string | null;
  email?: string | null;
  planId?: string | null;
};

export type AiErrorInfo = {
  message: string;
  httpStatus?: number;
};

export type AiGenerationSignal = TelemetryIdentity & {
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
  properties?: TelemetryProperties;
};

export type AiEmbeddingSignal = TelemetryIdentity & {
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
  properties?: TelemetryProperties;
};

export type AiFeedbackRating = 1 | -1;

export type AiFeedbackSignal = TelemetryIdentity & {
  traceId: string;
  logId?: string;
  feedback: AiFeedbackRating;
  score?: number;
  messageId?: string;
  conversationId?: string;
  properties?: TelemetryProperties;
};

export type ResolvedAiGeneration = AiGenerationSignal & {
  captureContent: boolean;
};

export type ResolvedAiEmbedding = AiEmbeddingSignal & {
  captureContent: boolean;
};

export type ResolvedAiFeedback = AiFeedbackSignal & {
  distinctId: string;
  personProperties?: TelemetryPersonProperties;
};

export type TrainingExampleSignal = TelemetryIdentity & {
  source: string;
  appName: string;
  userPrompt: string;
  assistantResponse: string;
  systemPrompt?: string;
  model?: string;
  conversationId?: string;
  startedAt?: number;
  previousMessages?: TelemetryMessage[];
  metadata?: Record<string, unknown>;
  userBehaviour?: Record<string, unknown>;
};

export interface AiGatewayPatchLog {
  score?: number | null;
  feedback?: AiFeedbackRating | null;
  metadata?: Record<string, string | number | boolean | null> | null;
}

export interface AiGatewayBinding {
  gateway(gatewayId: string): {
    patchLog(logId: string, data: AiGatewayPatchLog): Promise<void>;
  };
}

export type TelemetrySource = "server" | "client";

export type TelemetryRecordContext = {
  environment: string;
  app: string;
  source: TelemetrySource;
  appVersion?: string | null;
  sessionId?: string | null;
  path?: string | null;
  country?: string | null;
};

export type TelemetryRecord = {
  event_id: string;
  timestamp: number;
  environment: string;
  app: string;
  app_version: string | null;
  source: TelemetrySource;
  event_type: string;
  event_name: string;
  status: string | null;
  error_message: string | null;
  value: number | null;
  label: string | null;
  distinct_id: string | null;
  user_id: number | null;
  anonymous_id: string | null;
  plan_id: string | null;
  authenticated: boolean;
  session_id: string | null;
  trace_id: string | null;
  span_id: string | null;
  parent_span_id: string | null;
  path: string | null;
  country: string | null;
  ai_provider: string | null;
  ai_model: string | null;
  ai_latency_ms: number | null;
  ai_time_to_first_token_ms: number | null;
  ai_input_tokens: number | null;
  ai_output_tokens: number | null;
  ai_cached_input_tokens: number | null;
  ai_cache_creation_tokens: number | null;
  ai_reasoning_tokens: number | null;
  ai_stream: boolean | null;
  ai_stop_reason: string | null;
  ai_http_status: number | null;
  ai_tool_call_count: number | null;
  flag_key: string | null;
  flag_variant: string | null;
  properties: Record<string, unknown> | null;
};

export interface TelemetryStream {
  send(records: TelemetryRecord[]): Promise<void>;
}

export type TelemetryEnv = {
  TELEMETRY_STREAM?: TelemetryStream;
  AI?: AiGatewayBinding;
  ACCOUNT_ID?: string;
  AI_GATEWAY_TOKEN?: string;
  AI_OBSERVABILITY_ENABLED?: string;
  ENV?: string;
};

export interface TelemetrySink {
  name: string;
  capture?: (event: TelemetryEvent) => void;
  recordMetric?: (metric: TelemetryMetric) => void;
  captureAiGeneration?: (signal: ResolvedAiGeneration) => void;
  captureAiEmbedding?: (signal: ResolvedAiEmbedding) => void;
  captureAiFeedback?: (feedback: ResolvedAiFeedback) => void | Promise<void>;
  captureTrainingExample?: (signal: TrainingExampleSignal) => void | Promise<void>;
  log?: (record: TelemetryLogRecord) => void;
  exportSpan?: (span: TelemetrySpan) => void;
  flush?: () => Promise<void>;
}

export type CreateWorkerTelemetryOptions = {
  env: TelemetryEnv;
  executionCtx?: ExecutionContext;
  sentry?: SentryTelemetryClient;
  now?: () => number;
  sinks?: TelemetrySink[];
  resolveAiGatewayId?: () => string;
};
