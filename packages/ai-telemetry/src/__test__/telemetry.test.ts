import { describe, expect, it, vi } from "vitest";

import { createTelemetry } from "../telemetry.js";
import type { TelemetrySink } from "../types.js";

function recordingSink(name = "memory"): TelemetrySink & { seen: unknown[] } {
  const seen: unknown[] = [];

  return {
    name,
    seen,
    capture: (event) => void seen.push({ kind: "event", event }),
    recordMetric: (metric) => void seen.push({ kind: "metric", metric }),
    exportSpan: (span) => void seen.push({ kind: "span", span }),
    log: (record) => void seen.push({ kind: "log", record }),
    captureTrainingExample: async (signal) => void seen.push({ kind: "training", signal }),
  };
}

describe("createTelemetry", () => {
  it("captures AI content only when the user allows training data", () => {
    const sink = recordingSink();
    const telemetry = createTelemetry({
      sinks: [sink],
      aiObservability: { enabled: true },
    });
    const signal = {
      traceId: "t1",
      model: "gpt-5",
      provider: "openai",
      input: [{ role: "user", content: "secret" }],
      output: { role: "assistant", content: "answer" },
      user: { id: 7 },
      userTrackingEnabled: false,
    };

    telemetry.captureAiGeneration(signal);

    const fallback: TelemetrySink = { name: "events", capture: vi.fn() };
    const eventsOnly = createTelemetry({
      sinks: [fallback],
      aiObservability: { enabled: true },
    });

    eventsOnly.captureAiGeneration(signal);
    eventsOnly.captureAiGeneration({
      ...signal,
      user: undefined,
      userTrackingEnabled: true,
    });
    eventsOnly.captureAiGeneration({ ...signal, userTrackingEnabled: true });

    const [withoutConsent, anonymousOptIn, authenticatedOptIn] = vi
      .mocked(fallback.capture!)
      .mock.calls.map((call) => call[0].properties ?? {});

    expect(JSON.stringify(withoutConsent)).not.toContain("secret");
    expect(JSON.stringify(anonymousOptIn)).not.toContain("secret");
    expect(JSON.stringify(authenticatedOptIn)).toContain("secret");

    const disabled = createTelemetry({
      sinks: [fallback],
      aiObservability: { enabled: false },
    });

    disabled.captureAiGeneration(signal);
    expect(fallback.capture).toHaveBeenCalledTimes(3);
  });
});
