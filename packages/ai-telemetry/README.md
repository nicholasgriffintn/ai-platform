# @ngriffin_uk/polychat-ai-telemetry

Telemetry and analytics: a logger whose records can be forwarded to sinks, a `Telemetry` facade that fans events, metrics, spans, logs, AI generation signals and training examples out to sinks, and sinks for Analytics Engine, PostHog, the beacon endpoint, and OTLP over HTTP.

```ts
import { createWorkerTelemetry, getLogger } from "@ngriffin_uk/polychat-ai-telemetry";

const logger = getLogger({ prefix: "chat/turn" });
const telemetry = createWorkerTelemetry({ env, executionCtx });

const span = telemetry.startSpan("provider.call", { attributes: { provider: "openai" } });
telemetry.capture({ name: "chat.sent", category: "chat", distinctId: userId });
telemetry.captureAiGeneration(signal);
span.end();
await telemetry.flush();
```

`createWorkerTelemetry` builds the sinks the environment enables and applies the AI observability and content-capture settings from `TelemetryEnv`. `createTelemetry` takes any `TelemetrySink` list, and a sink implements only the methods it cares about. Sink failures are isolated and reported through `onSinkError`.

`toOtlpExportRequest` and `createOtlpHttpSink` render spans, logs, and metrics as OTLP JSON. `onLogRecord` subscribes to logger output so a host can ship logs through the same sinks. `captureTrainingExample` carries the prompt and response pairs recorded when a user allows training data, so that path shares sinks and consent handling with the rest of telemetry.

`createMetricsRecorder(telemetry)` layers validated metric recording, usage counters, token usage and guardrail violation tracking on top of a `Telemetry`; `createWorkerMetricsRecorder` builds it from the environment. Providers plug in through `createProviderMetrics` in `ai-providers`, which records latency, token usage and generation analytics around every provider call.

The usage helpers (`normaliseTokenUsage`, `extractUsagePayload`, `extractImpactPayload`) read provider responses into a stable token shape for metrics and billing.
