import type { AiGenerationSignal, Telemetry } from "@ngriffin_uk/polychat-ai-telemetry";
import { describe, expect, it } from "vitest";

import { createProviderMetrics } from "../provider-metrics.js";

function telemetryStub(signals: AiGenerationSignal[]): Telemetry {
  return {
    sinks: ["test"],
    capture: () => {},
    recordMetric: () => {},
    captureAiGeneration: (signal) => void signals.push(signal),
    captureAiEmbedding: () => {},
    captureAiFeedback: async () => {},
    captureTrainingExample: async () => {},
    log: () => {},
    startSpan: () => {
      throw new Error("not used");
    },
    flush: async () => {},
  };
}

function request(overrides: Record<string, unknown>) {
  return {
    env: {},
    completion_id: "conversation-1",
    messages: [{ role: "user", content: "hi" }],
    ...overrides,
  };
}

describe("createProviderMetrics", () => {
  it("uses the chat run as the generation trace so feedback can link to it", async () => {
    const signals: AiGenerationSignal[] = [];
    const metrics = createProviderMetrics({ telemetryFor: () => telemetryStub(signals) });

    await metrics.trackProviderOperation(
      {
        provider: "openai",
        model: "gpt-5",
        request: request({ run_id: "run-1" }),
      },
      async () => ({ response: "hello", usage: { prompt_tokens: 1, completion_tokens: 1 } }),
    );

    expect(signals[0]).toMatchObject({
      traceId: "run-1",
      sessionId: "conversation-1",
      spanName: "chat_completion",
    });
  });

  it("falls back to the conversation when no run is attached", async () => {
    const signals: AiGenerationSignal[] = [];
    const metrics = createProviderMetrics({ telemetryFor: () => telemetryStub(signals) });

    await metrics.trackProviderOperation(
      {
        provider: "openai",
        model: "gpt-5",
        request: request({}),
      },
      async () => ({ response: "hello" }),
    );

    expect(signals[0]).toMatchObject({ traceId: "conversation-1", sessionId: "conversation-1" });
  });
});
