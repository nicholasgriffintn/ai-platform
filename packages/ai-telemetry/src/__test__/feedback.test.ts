import type { PostHog } from "posthog-node";
import { describe, expect, it, vi } from "vitest";

import { buildAiFeedbackProperties } from "../ai-feedback-properties.js";
import { createAiGatewaySink } from "../sinks/ai-gateway.js";
import { createPostHogSink } from "../sinks/posthog.js";
import { createTelemetry } from "../telemetry.js";
import type { ResolvedAiFeedback, TelemetryEnv, TelemetrySink } from "../types.js";

const POSTHOG_FEEDBACK_ENV: TelemetryEnv = {
  POSTHOG_BACKEND_ENABLED: "true",
  POSTHOG_PROJECT_API_KEY: "phc_test",
  POSTHOG_HOST: "https://eu.i.posthog.com",
  POSTHOG_FEEDBACK_SURVEY_ID: "survey-1",
};

function fakePostHogClient() {
  const capture = vi.fn();
  const flush = vi.fn().mockResolvedValue(undefined);

  return { capture, flush };
}

describe("buildAiFeedbackProperties", () => {
  it("maps thumbs to survey properties and keeps the trace and log identifiers", () => {
    expect(
      buildAiFeedbackProperties({
        surveyId: "survey-1",
        submissionId: "submission-1",
        traceId: "conversation-1",
        feedback: -1,
        logId: "log-1",
        messageId: "message-1",
        conversationId: "conversation-1",
      }),
    ).toEqual({
      $survey_id: "survey-1",
      $survey_response: "2",
      $survey_completed: true,
      $survey_submission_id: "submission-1",
      $ai_trace_id: "conversation-1",
      log_id: "log-1",
      message_id: "message-1",
      conversation_id: "conversation-1",
    });
  });
});

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

describe("posthog feedback sink", () => {
  it("captures a survey response linked to the conversation trace", async () => {
    const client = fakePostHogClient();
    const sink = createPostHogSink(POSTHOG_FEEDBACK_ENV, () => client as unknown as PostHog);

    await sink?.captureAiFeedback?.({
      traceId: "conversation-1",
      logId: "log-1",
      feedback: 1,
      messageId: "message-1",
      conversationId: "conversation-1",
      distinctId: "user:7",
      personProperties: { user_id: "7" },
    });

    expect(client.capture).toHaveBeenCalledWith({
      distinctId: "user:7",
      event: "survey sent",
      properties: expect.objectContaining({
        category: "ai_observability",
        $survey_id: "survey-1",
        $survey_response: "1",
        $survey_completed: true,
        $survey_submission_id: expect.any(String),
        $ai_trace_id: "conversation-1",
        log_id: "log-1",
        message_id: "message-1",
        $set: { user_id: "7" },
      }),
    });
  });

  it("does not handle feedback when no survey is configured", () => {
    const sink = createPostHogSink(
      { ...POSTHOG_FEEDBACK_ENV, POSTHOG_FEEDBACK_SURVEY_ID: undefined },
      () => fakePostHogClient() as unknown as PostHog,
    );

    expect(sink?.captureAiFeedback).toBeUndefined();
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
