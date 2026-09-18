# @ngriffin_uk/polychat-ai-telemetry

Telemetry and analytics: a logger whose records can be forwarded to sinks, a `Telemetry` facade that fans events, metrics, spans, logs, AI generation, embedding and user feedback signals, and training examples out to sinks, and sinks for Analytics Engine, PostHog, the beacon endpoint, AI Gateway feedback and OTLP over HTTP.

```ts
import { createWorkerTelemetry, getLogger } from "@ngriffin_uk/polychat-ai-telemetry";

const logger = getLogger({ prefix: "chat/turn" });
const telemetry = createWorkerTelemetry({ env, executionCtx });

const span = telemetry.startSpan("provider.call", { attributes: { provider: "openai" } });
telemetry.capture({ name: "chat.sent", category: "chat", distinctId: userId });
telemetry.captureAiGeneration(signal);
await telemetry.captureAiFeedback({ traceId, logId, feedback: 1, user });
span.end();
await telemetry.flush();
```

`createWorkerTelemetry` builds the sinks the environment enables and applies the AI observability settings from `TelemetryEnv`. Prompt and response content is only attached when the authenticated user has allowed prompt and response training data. `createTelemetry` takes any `TelemetrySink` list, and a sink implements only the methods it cares about. Sink failures are isolated and reported through `onSinkError`.

`captureAiFeedback` fans thumbs feedback out to the sinks that handle it: the AI Gateway sink patches the stored log when the message has a log id, and the PostHog sink captures a survey response linked to the chat run trace when `POSTHOG_FEEDBACK_SURVEY_ID` is configured. Both share the same trace, message and log identifiers.

`toOtlpExportRequest` and `createOtlpHttpSink` render spans, logs, and metrics as OTLP JSON. `onLogRecord` subscribes to logger output so a host can ship logs through the same sinks. `captureTrainingExample` carries the prompt and response pairs recorded when a user allows training data, so that path shares sinks and consent handling with the rest of telemetry.

`createMetricsRecorder(telemetry)` layers validated metric recording, usage counters and guardrail violation tracking on top of a `Telemetry`; `createWorkerMetricsRecorder` builds it from the environment. Providers plug in through `createProviderMetrics` in `ai-providers`, which emits PostHog-standard `$ai_generation` events (tools, stop reason, streaming latency, errors) for every provider call, and embedding providers emit `$ai_embedding` through the same facade.

The usage helpers (`normaliseTokenUsage`, `extractUsagePayload`, `extractImpactPayload`) read provider responses into a stable token shape for generation events and billing.
