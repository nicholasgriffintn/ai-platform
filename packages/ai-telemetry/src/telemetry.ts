import { buildAiEmbeddingEvent } from "./ai-embedding.js";
import { buildAiGenerationEvent } from "./ai-generation.js";
import { shouldCaptureAiObservability } from "./config.js";
import { buildAnalyticsDistinctId, buildTelemetryPersonProperties } from "./identity.js";
import { createSpanId, createTraceId } from "./ids.js";
import { createAiGatewaySink } from "./sinks/ai-gateway.js";
import { createAnalyticsEngineSink } from "./sinks/analytics-engine.js";
import { createBeaconSink } from "./sinks/beacon.js";
import { createPostHogSink } from "./sinks/posthog.js";
import type {
  AiEmbeddingSignal,
  AiFeedbackSignal,
  AiGenerationSignal,
  CreateWorkerTelemetryOptions,
  ResolvedAiFeedback,
  TelemetryEnv,
  TelemetryEvent,
  TelemetryIdentity,
  TelemetryLogRecord,
  TelemetryMetric,
  TelemetrySink,
  TelemetrySpan,
  TrainingExampleSignal,
} from "./types.js";

export interface ActiveSpan {
  readonly traceId: string;
  readonly spanId: string;
  setAttribute(key: string, value: unknown): void;
  end(status?: { ok?: boolean; error?: unknown }): TelemetrySpan;
}

export interface StartSpanOptions {
  traceId?: string;
  parentSpanId?: string;
  attributes?: Record<string, unknown>;
}

export interface Telemetry {
  readonly sinks: readonly string[];
  capture(event: TelemetryEvent): void;
  recordMetric(metric: TelemetryMetric): void;
  captureAiGeneration(signal: AiGenerationSignal): void;
  captureAiEmbedding(signal: AiEmbeddingSignal): void;
  captureAiFeedback(signal: AiFeedbackSignal): Promise<void>;
  captureTrainingExample(signal: TrainingExampleSignal): Promise<void>;
  log(record: TelemetryLogRecord): void;
  startSpan(name: string, options?: StartSpanOptions): ActiveSpan;
  flush(): Promise<void>;
}

export interface CreateTelemetryOptions {
  sinks: TelemetrySink[];
  now?: () => number;
  aiObservability?: {
    enabled: boolean;
  };
  onSinkError?: (sink: string, error: unknown) => void;
}

function eachSink(
  sinks: TelemetrySink[],
  onSinkError: CreateTelemetryOptions["onSinkError"],
  run: (sink: TelemetrySink) => void,
): void {
  for (const sink of sinks) {
    try {
      run(sink);
    } catch (error) {
      onSinkError?.(sink.name, error);
    }
  }
}

export function createTelemetry(options: CreateTelemetryOptions): Telemetry {
  const now = options.now ?? Date.now;
  const sinks = options.sinks;
  const onSinkError = options.onSinkError;
  const capture = (event: TelemetryEvent) =>
    eachSink(sinks, onSinkError, (sink) => sink.capture?.(event));
  const recordMetric = (metric: TelemetryMetric) =>
    eachSink(sinks, onSinkError, (sink) => {
      if (sink.recordMetric) {
        sink.recordMetric(metric);

        return;
      }

      sink.capture?.({
        name: metric.name,
        category: metric.type,
        distinctId: metric.distinctId ?? metric.traceId,
        personProperties: metric.personProperties,
        value: metric.value,
        properties: metric.metadata,
      });
    });

  const observability = options.aiObservability ?? { enabled: true };

  const resolveAiEventIdentity = (signal: TelemetryIdentity) => ({
    distinctId: buildAnalyticsDistinctId(signal),
    personProperties: buildTelemetryPersonProperties({
      userId: signal.user?.id,
      anonymousUserId: signal.anonymousUser?.id,
      email: signal.user?.email,
      planId: signal.user?.plan_id,
    }),
    captureContent: Boolean(signal.user?.id) && signal.userTrackingEnabled === true,
  });

  return {
    sinks: sinks.map((sink) => sink.name),
    capture,
    recordMetric,
    captureAiGeneration: (signal) => {
      if (!observability.enabled) {
        return;
      }

      capture(buildAiGenerationEvent({ ...signal, ...resolveAiEventIdentity(signal) }));
    },
    captureAiEmbedding: (signal) => {
      if (!observability.enabled) {
        return;
      }

      capture(buildAiEmbeddingEvent({ ...signal, ...resolveAiEventIdentity(signal) }));
    },
    captureAiFeedback: async (signal) => {
      const { distinctId, personProperties } = resolveAiEventIdentity(signal);
      const resolved: ResolvedAiFeedback = { ...signal, distinctId, personProperties };

      for (const sink of sinks) {
        if (!sink.captureAiFeedback) {
          continue;
        }

        try {
          await sink.captureAiFeedback(resolved);
        } catch (error) {
          onSinkError?.(sink.name, error);
        }
      }
    },
    captureTrainingExample: async (signal) => {
      for (const sink of sinks) {
        try {
          await sink.captureTrainingExample?.(signal);
        } catch (error) {
          onSinkError?.(sink.name, error);
        }
      }
    },
    log: (record) => eachSink(sinks, onSinkError, (sink) => sink.log?.(record)),
    startSpan: (name, spanOptions = {}) => {
      const traceId = spanOptions.traceId ?? createTraceId();
      const spanId = createSpanId();
      const startTime = now();
      const attributes: Record<string, unknown> = { ...spanOptions.attributes };
      let ended: TelemetrySpan | undefined;

      return {
        traceId,
        spanId,
        setAttribute: (key, value) => {
          attributes[key] = value;
        },
        end: (status = {}) => {
          if (ended) {
            return ended;
          }

          const error = status.error;

          ended = {
            traceId,
            spanId,
            parentSpanId: spanOptions.parentSpanId,
            name,
            startTime,
            endTime: now(),
            status: error ? "error" : status.ok === false ? "error" : "ok",
            statusMessage: error instanceof Error ? error.message : undefined,
            attributes,
          };
          eachSink(sinks, onSinkError, (sink) => sink.exportSpan?.(ended as TelemetrySpan));

          return ended;
        },
      };
    },
    flush: async () => {
      for (const sink of sinks) {
        try {
          await sink.flush?.();
        } catch (error) {
          onSinkError?.(sink.name, error);
        }
      }
    },
  };
}

export function createWorkerTelemetrySinks({
  env,
  executionCtx,
  createPostHogClient,
  fetcher = fetch,
  now = Date.now,
  resolveAiGatewayId,
}: Omit<CreateWorkerTelemetryOptions, "sinks">): TelemetrySink[] {
  return [
    createAnalyticsEngineSink(env, now),
    createPostHogSink(env, createPostHogClient, executionCtx),
    createBeaconSink(env, fetcher, executionCtx, now),
    resolveAiGatewayId ? createAiGatewaySink(env, resolveAiGatewayId) : null,
  ].filter((sink): sink is TelemetrySink => sink !== null);
}

export function createWorkerTelemetry(options: CreateWorkerTelemetryOptions): Telemetry {
  const env: TelemetryEnv = options.env;

  return createTelemetry({
    sinks: [...createWorkerTelemetrySinks(options), ...(options.sinks ?? [])],
    now: options.now,
    aiObservability: {
      enabled: shouldCaptureAiObservability(env),
    },
  });
}
