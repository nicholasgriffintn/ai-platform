import type { AiFeedbackSignal } from "@ngriffin_uk/polychat-ai-telemetry";
import { describe, expect, it, vi } from "vitest";

import { resolveFeedbackTarget } from "~/utils/feedback-target";

import {
  handleChatCompletionFeedbackSubmission,
  type ChatFeedbackContext,
} from "../chatCompletionFeedbackSubmission.js";

function createContext(
  overrides: Partial<ChatFeedbackContext> = {},
): ChatFeedbackContext & { updateById: ReturnType<typeof vi.fn> } {
  const updateById = vi.fn().mockResolvedValue(undefined);
  const findMany = vi.fn().mockResolvedValue([]);

  return {
    env: {},
    user: { id: 7, email: "person@example.com" },
    messages: [
      { id: "message-1", role: "user" },
      { id: "message-2", role: "assistant", log_id: "log-2", run_id: "run-2" },
    ],
    repositories: {
      trainingExamples: { findMany, updateById },
    },
    updateById,
    ...overrides,
  };
}

describe("handleChatCompletionFeedbackSubmission", () => {
  it("resolves the generation trace and log ids from the rated message", async () => {
    const signals: AiFeedbackSignal[] = [];
    const context = createContext();

    await handleChatCompletionFeedbackSubmission(context, {
      request: { message_id: "message-2", feedback: 1 },
      completion_id: "conversation-1",
      telemetry: {
        captureAiFeedback: async (signal) => void signals.push(signal),
      },
    });

    expect(signals).toEqual([
      expect.objectContaining({
        traceId: "run-2",
        conversationId: "conversation-1",
        messageId: "message-2",
        logId: "log-2",
        feedback: 1,
        user: { id: 7, email: "person@example.com" },
      }),
    ]);
  });

  it("falls back to the latest assistant message and its run when only the conversation is known", async () => {
    const signals: AiFeedbackSignal[] = [];
    const context = createContext();

    await handleChatCompletionFeedbackSubmission(context, {
      request: { feedback: -1 },
      completion_id: "conversation-1",
      telemetry: {
        captureAiFeedback: async (signal) => void signals.push(signal),
      },
    });

    expect(signals[0]).toMatchObject({
      messageId: "message-2",
      logId: "log-2",
      traceId: "run-2",
      feedback: -1,
    });
  });

  it("keeps posthog feedback without a log id and rejects unknown targets", async () => {
    const signals: AiFeedbackSignal[] = [];
    const context = createContext({
      messages: [{ id: "message-1", role: "assistant" }],
    });

    await handleChatCompletionFeedbackSubmission(context, {
      request: { message_id: "message-1", feedback: 1 },
      completion_id: "conversation-1",
      telemetry: {
        captureAiFeedback: async (signal) => void signals.push(signal),
      },
    });

    expect(signals[0]).toMatchObject({ logId: undefined, traceId: "conversation-1" });

    await expect(
      handleChatCompletionFeedbackSubmission(context, {
        request: { message_id: "missing", feedback: 1 },
        completion_id: "conversation-1",
        telemetry: { captureAiFeedback: vi.fn() },
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("resolveFeedbackTarget", () => {
  const messages = [
    { id: "message-1", role: "user" },
    { id: "message-2", role: "assistant", log_id: "log-2" },
    { id: "message-3", role: "tool", log_id: "log-3" },
  ];

  it("prefers an explicit message id, then a log id, then the latest assistant message", () => {
    expect(resolveFeedbackTarget(messages, { message_id: "message-1" })).toMatchObject({
      id: "message-1",
    });
    expect(resolveFeedbackTarget(messages, { log_id: "log-3" })).toMatchObject({
      id: "message-3",
    });
    expect(resolveFeedbackTarget(messages, {})).toMatchObject({ id: "message-2" });
  });
});
