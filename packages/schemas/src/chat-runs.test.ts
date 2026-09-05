import { describe, expect, it } from "vitest";

import { getChatCompletionResponseSchema } from "./chat";
import { createChatCompletionsJsonSchema } from "./chat-completions";
import {
  CHAT_RUN_EVENT_RETENTION_LIMIT,
  canTransitionChatRun,
  chatRunCommandReceiptSchema,
  chatRunRecoveryResponseSchema,
  chatRunReplayQuerySchema,
  chatRunReplayResponseSchema,
  chatRunSchema,
  cancelChatRunRequestSchema,
  isTerminalChatRunStatus,
} from "./chat-runs";

const run = {
  protocolVersion: 1,
  id: "run-1",
  conversationId: "conversation-1",
  projectId: null,
  projectTaskId: null,
  initiatorUserId: 42,
  status: "running",
  attempt: 1,
  createdAt: "2026-09-05T01:00:00.000Z",
  updatedAt: "2026-09-05T01:00:01.000Z",
  startedAt: "2026-09-05T01:00:01.000Z",
  completedAt: null,
  terminalReason: null,
  lastMessageId: null,
} as const;

describe("chat run contracts", () => {
  it("parses additive run and command receipt fields", () => {
    expect(chatRunSchema.parse(run)).toEqual(run);
    expect(
      chatRunCommandReceiptSchema.parse({
        protocolVersion: 1,
        commandId: "command-1",
        run,
        kind: "turn",
        acceptedAt: "2026-09-05T01:00:00.000Z",
        duplicate: false,
      }),
    ).toMatchObject({ commandId: "command-1", run: { id: "run-1" } });
    expect(
      createChatCompletionsJsonSchema.parse({
        command_id: "command-1",
        run_id: "run-1",
        model: "gpt-6-astra",
        messages: [{ role: "user", content: "Continue" }],
      }),
    ).toMatchObject({ command_id: "command-1", run_id: "run-1" });
    expect(
      getChatCompletionResponseSchema.partial().parse({ id: "conversation-1", latest_run: run }),
    ).toMatchObject({ latest_run: { id: "run-1" } });
  });

  it("allows waiting and cancellation transitions but never reopens terminal runs", () => {
    expect(canTransitionChatRun("accepted", "running")).toBe(true);
    expect(canTransitionChatRun("running", "awaiting_approval")).toBe(true);
    expect(canTransitionChatRun("awaiting_approval", "running")).toBe(true);
    expect(canTransitionChatRun("running", "cancelling")).toBe(true);
    expect(canTransitionChatRun("cancelling", "cancelled")).toBe(true);
    expect(canTransitionChatRun("succeeded", "running")).toBe(false);
    expect(canTransitionChatRun("failed", "succeeded")).toBe(false);
    expect(isTerminalChatRunStatus("interrupted")).toBe(true);
    expect(isTerminalChatRunStatus("awaiting_input")).toBe(false);
  });

  it("requires cancellation to name the observed run attempt", () => {
    expect(
      cancelChatRunRequestSchema.parse({ command_id: "cancel-1", expected_attempt: 2 }),
    ).toEqual({ command_id: "cancel-1", expected_attempt: 2 });
    expect(cancelChatRunRequestSchema.safeParse({ command_id: "cancel-1" }).success).toBe(false);
  });

  it("parses an additive recovery snapshot with all stored run messages", () => {
    expect(
      chatRunRecoveryResponseSchema.parse({
        run,
        messages: [
          { id: "tool-1", role: "tool", content: "", run_id: run.id, status: "success" },
          { id: "assistant-1", role: "assistant", content: "Done", run_id: run.id },
        ],
      }),
    ).toMatchObject({
      run: { id: run.id },
      messages: [{ id: "tool-1" }, { id: "assistant-1" }],
    });
  });
});

describe("chat run event replay", () => {
  it("uses bounded cursor inputs", () => {
    expect(chatRunReplayQuerySchema.parse({ after: "4" })).toEqual({ after: 4, limit: 100 });
    expect(chatRunReplayQuerySchema.safeParse({ after: -1 }).success).toBe(false);
    expect(chatRunReplayQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
    expect(CHAT_RUN_EVENT_RETENTION_LIMIT).toBe(500);
  });

  it("represents an explicit retention reset with an authoritative snapshot", () => {
    expect(
      chatRunReplayResponseSchema.parse({
        protocolVersion: 1,
        runId: "run-1",
        fromCursor: 2,
        nextCursor: 501,
        resetRequired: true,
        events: [],
        snapshot: {
          protocolVersion: 1,
          cursor: 501,
          run,
          messages: [
            {
              id: "assistant-1",
              role: "assistant",
              content: "Current result",
              run_id: "run-1",
            },
          ],
        },
      }),
    ).toMatchObject({ resetRequired: true, nextCursor: 501 });
  });

  it("keeps event types additive while retaining stable ordering fields", () => {
    const response = chatRunReplayResponseSchema.parse({
      protocolVersion: 1,
      runId: "run-1",
      fromCursor: 4,
      nextCursor: 5,
      resetRequired: false,
      snapshot: null,
      events: [
        {
          protocolVersion: 1,
          id: "event-5",
          runId: "run-1",
          sequence: 5,
          attempt: 1,
          type: "future.additive_event",
          occurredAt: "2026-09-05T12:00:05.000Z",
          data: {},
        },
      ],
    });

    expect(response.events[0]?.type).toBe("future.additive_event");
  });
});
