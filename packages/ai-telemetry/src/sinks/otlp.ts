import { getLogger } from "../logger.js";
import { getOtlpConfig } from "../otlp-config.js";
import { createOtlpHttpSink } from "../otlp-http.js";
import {
  buildOtlpAiSignals,
  sanitiseOperationalLog,
  sanitiseOperationalMetric,
  sanitiseOperationalSpan,
} from "../otlp-signals.js";
import type {
  BeaconFetcher,
  TelemetryEnv,
  TelemetryExecutionContext,
  TelemetrySink,
} from "../types.js";

const logger = getLogger({ prefix: "ai-telemetry/otlp" });

export function createOtlpSink(
  env: TelemetryEnv,
  fetcher: BeaconFetcher,
  executionCtx: TelemetryExecutionContext | undefined,
  now: () => number,
): TelemetrySink | null {
  const config = getOtlpConfig(env);

  if (!config) {
    if (env.OTEL_EXPORTER_OTLP_ENDPOINT) {
      logger.warn("OTLP export disabled because its configuration is invalid");
    }

    return null;
  }

  const transport = createOtlpHttpSink({
    ...config,
    fetcher,
    autoFlush: true,
    attributes: env.ENV ? { "deployment.environment.name": env.ENV } : undefined,
    waitUntil: executionCtx ? (task) => executionCtx.waitUntil(task) : undefined,
    onError: () => logger.warn("OTLP export failed or reached its buffer limit"),
  });

  return {
    name: transport.name,
    capture(event) {
      const signals = buildOtlpAiSignals(event, now());

      if (!signals) {
        return;
      }

      transport.exportSpan?.(signals.span);
      for (const metric of signals.metrics) {
        transport.recordMetric?.(metric);
      }

      if (signals.log) {
        transport.log?.(signals.log);
      }
    },
    exportSpan: (span) => transport.exportSpan?.(sanitiseOperationalSpan(span)),
    recordMetric: (metric) => transport.recordMetric?.(sanitiseOperationalMetric(metric)),
    log: (record) => transport.log?.(sanitiseOperationalLog(record)),
    flush: transport.flush,
  };
}
