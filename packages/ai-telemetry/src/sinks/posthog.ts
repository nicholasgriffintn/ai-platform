import type { ExecutionContext } from "@cloudflare/workers-types";
import { omitNullishValues } from "@ngriffin_uk/polychat-utility-server/objects";
import { PostHog } from "posthog-node";

import { buildAiFeedbackProperties } from "../ai-feedback-properties.js";
import { getPostHogAnalyticsConfig, getPostHogFeedbackConfig } from "../config.js";
import { AI_FEEDBACK_EVENT_NAME, AI_OBSERVABILITY_EVENT_CATEGORY } from "../constants.js";
import type { CreateWorkerTelemetryOptions, TelemetryEnv, TelemetrySink } from "../types.js";

export function createPostHogSink(
  env: TelemetryEnv,
  createPostHogClient: CreateWorkerTelemetryOptions["createPostHogClient"] = createDefaultPostHogClient,
  executionCtx?: ExecutionContext,
): TelemetrySink | null {
  const config = getPostHogAnalyticsConfig(env);

  if (!config || !createPostHogClient) {
    return null;
  }

  const client = createPostHogClient(config.apiKey, {
    host: config.host,
  });
  const feedbackConfig = getPostHogFeedbackConfig(env);

  return {
    name: "posthog",
    capture(event) {
      const personProperties = omitNullishValues(event.personProperties ?? {});

      client.capture({
        distinctId: event.distinctId,
        event: event.name,
        properties: omitNullishValues({
          category: event.category,
          ...event.properties,
          ...(Object.keys(personProperties).length > 0 ? { $set: personProperties } : {}),
          ...(event.label !== undefined ? { label: event.label } : {}),
          ...(event.value !== undefined ? { value: event.value } : {}),
          ...(event.nonInteraction !== undefined ? { non_interaction: event.nonInteraction } : {}),
        }),
      });
      schedulePostHogFlush(client, executionCtx);
    },
    ...(feedbackConfig
      ? {
          captureAiFeedback(feedback) {
            const personProperties = omitNullishValues(feedback.personProperties ?? {});

            client.capture({
              distinctId: feedback.distinctId,
              event: AI_FEEDBACK_EVENT_NAME,
              properties: omitNullishValues({
                category: AI_OBSERVABILITY_EVENT_CATEGORY,
                ...buildAiFeedbackProperties({
                  surveyId: feedbackConfig.surveyId,
                  submissionId: crypto.randomUUID(),
                  traceId: feedback.traceId,
                  feedback: feedback.feedback,
                  logId: feedback.logId,
                  messageId: feedback.messageId,
                  conversationId: feedback.conversationId,
                  properties: feedback.properties,
                }),
                ...(Object.keys(personProperties).length > 0 ? { $set: personProperties } : {}),
              }),
            });
            schedulePostHogFlush(client, executionCtx);
          },
        }
      : {}),
  };
}

function schedulePostHogFlush(client: PostHog, executionCtx?: ExecutionContext): void {
  const flushPromise = client.flush();
  const guardedFlush = flushPromise.catch((err) => {
    console.error("[PostHog] flush failed:", err);
  });

  if (executionCtx) {
    executionCtx.waitUntil(guardedFlush);

    return;
  }

  void guardedFlush;
}

function createDefaultPostHogClient(
  apiKey: string,
  options: ConstructorParameters<typeof PostHog>[1],
): PostHog {
  return new PostHog(apiKey, options);
}
