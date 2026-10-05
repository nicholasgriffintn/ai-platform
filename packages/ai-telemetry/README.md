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

Set `OTEL_EXPORTER_OTLP_ENDPOINT` to a public HTTPS collector base URL to enable native OTLP JSON export in `createWorkerTelemetry`. Set `OTEL_EXPORTER_OTLP_HEADERS` to comma-separated, percent-encoded header pairs, such as `Authorization=Bearer%20example-token`, and optionally set `OTEL_SERVICE_NAME`. Preserve any collector tenant path; the exporter appends `v1/traces`, `v1/logs`, and `v1/metrics`.

The configured OTLP sink exports AI generation and embedding spans, token and duration measurements, and explicitly recorded operational spans, metrics and logs. It excludes prompts, responses, tool names and arguments, personal identity, arbitrary metadata and raw error text, including when training consent is enabled. Trace and span identifiers are deterministically mapped to OTLP hexadecimal identifiers; metrics omit trace identifiers to avoid per-run series.

Pass `executionCtx` to register background exports with Worker `waitUntil`, or await `telemetry.flush()` before the host finishes. The buffer holds at most 256 records or 1 MiB, plus one bounded in-flight batch. Exports use five-second request timeouts and at most three attempts for network failures or HTTP 429, 502, 503 and 504, with bounded backoff. Records that exceed the buffer or exhaust retries are dropped with an operational warning; this is best-effort telemetry. Partial collector rejection is reported without replaying accepted data.

`toOtlpExportRequest` and `createOtlpHttpSink` render spans, logs, and metrics as OTLP JSON. The lower-level sink exports the caller's supplied attributes and log bodies; use the configured Worker sink for the operational allowlist. `onLogRecord` subscribes to logger output so a host can ship logs through the same sinks. `captureTrainingExample` carries the prompt and response pairs recorded when a user allows training data, so that path shares sinks and consent handling with the rest of telemetry.

`createMetricsRecorder(telemetry)` layers validated metric recording, usage counters and guardrail violation tracking on top of a `Telemetry`; `createWorkerMetricsRecorder` builds it from the environment. Providers plug in through `createProviderMetrics` in `ai-providers`, which emits PostHog-standard `$ai_generation` events (tools, stop reason, streaming latency, errors) for every provider call, and embedding providers emit `$ai_embedding` through the same facade.

The usage helpers (`normaliseTokenUsage`, `extractUsagePayload`, `extractImpactPayload`) read provider responses into a stable token shape for generation events and billing.
