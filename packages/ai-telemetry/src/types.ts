import type { AnalyticsEngineDataset, ExecutionContext } from "@cloudflare/workers-types";
import type { AnalyticsEvent } from "@ngriffin_uk/polychat-schemas";
import type { PostHog, PostHogOptions } from "posthog-node";

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

export type BeaconFetcher = (input: string, init: RequestInit) => Promise<Response>;

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

export type TelemetryEnv = {
  ANALYTICS?: AnalyticsEngineDataset;
  AI?: AiGatewayBinding;
  ACCOUNT_ID?: string;
  AI_GATEWAY_TOKEN?: string;
  POSTHOG_PROJECT_API_KEY?: string;
  POSTHOG_HOST?: string;
  POSTHOG_BACKEND_ENABLED?: string;
  POSTHOG_AI_OBSERVABILITY_ENABLED?: string;
  POSTHOG_FEEDBACK_SURVEY_ID?: string;
  AI_OBSERVABILITY_ENABLED?: string;
  BEACON_BACKEND_ENABLED?: string;
  BEACON_ENDPOINT?: string;
  BEACON_SITE_ID?: string;
  ENV?: string;
};

export interface TelemetrySink {
  name: string;
  capture?: (event: TelemetryEvent) => void;
  recordMetric?: (metric: TelemetryMetric) => void;
  captureAiGeneration?: (signal: AiGenerationSignal) => void;
  captureAiFeedback?: (feedback: ResolvedAiFeedback) => void | Promise<void>;
  captureTrainingExample?: (signal: TrainingExampleSignal) => void | Promise<void>;
  log?: (record: TelemetryLogRecord) => void;
  exportSpan?: (span: TelemetrySpan) => void;
  flush?: () => Promise<void>;
}

export type CreateWorkerTelemetryOptions = {
  env: TelemetryEnv;
  executionCtx?: ExecutionContext;
  createPostHogClient?: (apiKey: string, options: PostHogOptions) => PostHog;
  fetcher?: BeaconFetcher;
  now?: () => number;
  sinks?: TelemetrySink[];
  resolveAiGatewayId?: () => string;
};
