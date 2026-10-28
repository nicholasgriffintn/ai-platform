import { describe, expect, it, vi } from "vitest";

import { createAiGatewaySink } from "../sinks/ai-gateway.js";
import { createSentrySink, type SentryTelemetryClient } from "../sinks/sentry.js";
import { createTelemetry } from "../telemetry.js";
import type { ResolvedAiFeedback, TelemetryEnv, TelemetrySink } from "../types.js";

function fakeSentryClient(activeSpan?: { isRecording(): boolean }) {
  const span = { setStatus: vi.fn(), end: vi.fn() };
  const client: SentryTelemetryClient = {
    getActiveSpan: () => activeSpan,
    startInactiveSpan: vi.fn(() => span),
    captureFeedback: vi.fn(() => "feedback-1"),
  };

  return { client, span };
}

describe("captureAiFeedback", () => {
  it("resolves identity before fanning feedback out to sinks", async () => {
    const seen: ResolvedAiFeedback[] = [];
    const sink: TelemetrySink = {
      name: "feedback",
      captureAiFeedback: async (feedback) => void seen.push(feedback),
    };
    const telemetry = createTelemetry({ sinks: [sink] });

    await telemetry.captureAiFeedback({
      traceId: "conversation-1",
      feedback: 1,
      user: { id: 7, email: "person@example.com" },
    });

    expect(seen[0]).toMatchObject({
      traceId: "conversation-1",
      feedback: 1,
      distinctId: "user:7",
      personProperties: { user_id: "7", email: "person@example.com" },
    });
  });

  it("isolates sink failures", async () => {
    const onSinkError = vi.fn();
    const telemetry = createTelemetry({
      sinks: [
        {
          name: "broken",
          captureAiFeedback: () => Promise.reject(new Error("down")),
        },
      ],
      onSinkError,
    });

    await expect(
      telemetry.captureAiFeedback({ traceId: "t1", feedback: 1 }),
    ).resolves.toBeUndefined();
    expect(onSinkError).toHaveBeenCalledWith("broken", expect.any(Error));
  });
});

describe("sentry sink", () => {
  it("captures feedback linked to the conversation trace", async () => {
    const { client } = fakeSentryClient();
    const sink = createSentrySink(client);

    await sink?.captureAiFeedback?.({
      traceId: "conversation-1",
      logId: "log-1",
      feedback: -1,
      messageId: "message-1",
      distinctId: "user:7",
    });

    expect(client.captureFeedback).toHaveBeenCalledWith({
      message: "Negative response feedback",
      source: "ai_response",
      tags: {
        ai_feedback: "negative",
        ai_trace_id: "conversation-1",
        distinct_id: "user:7",
        log_id: "log-1",
        message_id: "message-1",
      },
    });
  });

  it("records generations as agent spans and only attaches content with consent", () => {
    const { client, span } = fakeSentryClient();
    const sink = createSentrySink(client, () => 10_000);
    const telemetry = createTelemetry({
      sinks: sink ? [sink] : [],
      aiObservability: { enabled: true },
    });
    const signal = {
      traceId: "t1",
      model: "gpt-5",
      provider: "openai",
      latencyMs: 1_500,
      usage: { prompt_tokens: 12, completion_tokens: 3 },
      input: [{ role: "user", content: "secret" }],
      output: { role: "assistant", content: "answer" },
      user: { id: 7 },
      error: { message: "rate limited" },
    };

    telemetry.captureAiGeneration({ ...signal, userTrackingEnabled: false });
    telemetry.captureAiGeneration({ ...signal, userTrackingEnabled: true });

    const [withoutConsent, withConsent] = vi
      .mocked(client.startInactiveSpan)
      .mock.calls.map((call) => call[0]);

    expect(withoutConsent).toMatchObject({
      name: "chat gpt-5",
      op: "gen_ai.chat",
      startTime: 8_500,
      forceTransaction: true,
      attributes: {
        "gen_ai.operation.name": "chat",
        "gen_ai.system": "openai",
        "gen_ai.request.model": "gpt-5",
        "gen_ai.usage.input_tokens": 12,
        "gen_ai.usage.output_tokens": 3,
      },
    });
    expect(JSON.stringify(withoutConsent)).not.toContain("secret");
    expect(withConsent?.attributes["gen_ai.input.messages"]).toContain("secret");
    expect(span.setStatus).toHaveBeenCalledWith({ code: 2, message: "rate limited" });
    expect(span.end).toHaveBeenCalledWith(10_000);
  });

  it("nests generations under a recording agent run and starts their own trace otherwise", () => {
    const agentRun = fakeSentryClient({ isRecording: () => true });
    const unsampledRequest = fakeSentryClient({ isRecording: () => false });

    for (const { client } of [agentRun, unsampledRequest]) {
      createSentrySink(client)?.captureAiGeneration?.({ traceId: "t1", captureContent: false });
    }

    expect(vi.mocked(agentRun.client.startInactiveSpan).mock.calls[0]?.[0].forceTransaction).toBe(
      false,
    );
    expect(
      vi.mocked(unsampledRequest.client.startInactiveSpan).mock.calls[0]?.[0].forceTransaction,
    ).toBe(true);
  });

  it("is disabled without a Sentry client", () => {
    expect(createSentrySink(undefined)).toBeNull();
  });
});

describe("ai gateway feedback sink", () => {
  const gatewayId = () => "llm-assistant";

  function gatewayEnv() {
    const patchLog = vi.fn().mockResolvedValue(undefined);
    const gateway = vi.fn(() => ({ patchLog }));

    return {
      patchLog,
      gateway,
      env: {
        ACCOUNT_ID: "account-1",
        AI_GATEWAY_TOKEN: "token-1",
        AI: { gateway },
      } satisfies TelemetryEnv,
    };
  }

  it("patches the stored log with feedback and user metadata", async () => {
    const { patchLog, gateway, env } = gatewayEnv();
    const sink = createAiGatewaySink(env, gatewayId);

    await sink?.captureAiFeedback?.({
      traceId: "conversation-1",
      logId: "log-1",
      feedback: -1,
      score: 20,
      distinctId: "user:7",
      user: { id: 7, email: "person@example.com" },
    });

    expect(gateway).toHaveBeenCalledWith("llm-assistant");
    expect(patchLog).toHaveBeenCalledWith("log-1", {
      feedback: -1,
      score: 20,
      metadata: { user: "person@example.com" },
    });
  });

  it("skips the gateway when the message has no log id", async () => {
    const { patchLog, env } = gatewayEnv();
    const sink = createAiGatewaySink(env, gatewayId);

    await sink?.captureAiFeedback?.({
      traceId: "conversation-1",
      feedback: 1,
      distinctId: "user:7",
    });

    expect(patchLog).not.toHaveBeenCalled();
  });

  it("is disabled without the gateway bindings", () => {
    expect(createAiGatewaySink({}, gatewayId)).toBeNull();
    expect(
      createAiGatewaySink({ ACCOUNT_ID: "account-1", AI_GATEWAY_TOKEN: "token-1" }, gatewayId),
    ).toBeNull();
  });
});
