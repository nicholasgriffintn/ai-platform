import type { ChatRun, ChatRunEvent, ChatRunStatus } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import type { Message } from "~/types";

import {
  applyChatRunReplay,
  replaceConversationRunSnapshot,
  type AppChatRunReplayResponse,
  type AuthoritativeChatRunSnapshot,
  type ChatRunReplayState,
} from "../run-replay";

function run(status: ChatRunStatus, attempt = 1): ChatRun {
  return {
    protocolVersion: 1,
    id: "run-1",
    conversationId: "conversation-1",
    projectId: null,
    projectTaskId: null,
    initiatorUserId: 7,
    status,
    attempt,
    createdAt: "2026-09-05T12:00:00.000Z",
    updatedAt: "2026-09-05T12:00:01.000Z",
    startedAt: "2026-09-05T12:00:01.000Z",
    completedAt: null,
    terminalReason: null,
    lastMessageId: null,
  };
}

function snapshot(
  status: ChatRunStatus,
  cursor: number,
  messages: Message[] = [],
): AuthoritativeChatRunSnapshot {
  return { protocolVersion: 1, cursor, run: run(status), messages };
}

function event(sequence: number, status: ChatRunStatus, type = "run.status_changed"): ChatRunEvent {
  return {
    protocolVersion: 1,
    id: `event-${sequence}`,
    runId: "run-1",
    sequence,
    attempt: 1,
    type,
    occurredAt: `2026-09-05T12:00:0${sequence}.000Z`,
    data: { status },
  };
}

function replay(
  fromCursor: number,
  events: ChatRunEvent[],
  overrides: Partial<AppChatRunReplayResponse> = {},
): AppChatRunReplayResponse {
  return {
    protocolVersion: 1,
    runId: "run-1",
    fromCursor,
    nextCursor: events.at(-1)?.sequence ?? fromCursor,
    resetRequired: false,
    events,
    snapshot: null,
    ...overrides,
  };
}

describe("applyChatRunReplay", () => {
  it("replays retry state without changing the run attempt", () => {
    const state: ChatRunReplayState = { cursor: 1, snapshot: snapshot("running", 1) };
    const retryEvent: ChatRunEvent = {
      ...event(2, "running", "run.retry_changed"),
      data: {
        retry: {
          protocolVersion: 1,
          step: 2,
          attempt: 2,
          maxAttempts: 2,
          runRetry: 1,
          maxRunRetries: 2,
          phase: "waiting",
          classification: "timeout",
          reason: "The model provider did not respond in time.",
          scheduledAt: "2026-09-05T12:00:02.000Z",
          retryAt: "2026-09-05T12:00:03.000Z",
        },
      },
    };

    const waiting = applyChatRunReplay(state, replay(1, [retryEvent]));
    const cleared = applyChatRunReplay(
      waiting.state,
      replay(2, [{ ...retryEvent, sequence: 3, id: "event-3", data: { retry: null } }]),
    );

    expect(waiting.state.snapshot.run).toMatchObject({
      attempt: 1,
      retry: { attempt: 2, phase: "waiting" },
    });
    expect(cleared.state.snapshot.run.retry).toBeNull();
  });

  it("deduplicates and orders events without regressing terminal state", () => {
    const state: ChatRunReplayState = { cursor: 1, snapshot: snapshot("running", 1) };
    const outcome = applyChatRunReplay(
      state,
      replay(1, [event(3, "cancelled"), event(2, "cancelling"), event(2, "cancelling")]),
    );

    expect(outcome.requiresSnapshot).toBe(false);
    expect(outcome.state.cursor).toBe(3);
    expect(outcome.state.snapshot.run.status).toBe("cancelled");

    const stale = applyChatRunReplay(outcome.state, replay(3, [event(4, "running")]));

    expect(stale.state.cursor).toBe(4);
    expect(stale.state.snapshot.run.status).toBe("cancelled");
  });

  it("requires a snapshot rather than applying an event across a cursor gap", () => {
    const state: ChatRunReplayState = { cursor: 2, snapshot: snapshot("running", 2) };
    const outcome = applyChatRunReplay(state, replay(2, [event(4, "succeeded")]));

    expect(outcome.requiresSnapshot).toBe(true);
    expect(outcome.state).toBe(state);
  });

  it("replaces all state when the server declares a retention reset", () => {
    const state: ChatRunReplayState = { cursor: 2, snapshot: snapshot("running", 2) };
    const replacement = snapshot("succeeded", 505, [
      { id: "assistant-1", role: "assistant", content: "Done", run_id: "run-1" },
    ]);
    const outcome = applyChatRunReplay(
      state,
      replay(2, [], { nextCursor: 505, resetRequired: true, snapshot: replacement }),
    );

    expect(outcome.requiresSnapshot).toBe(false);
    expect(outcome.state).toEqual({ cursor: 505, snapshot: replacement });
  });

  it("uses snapshot fallback for message references, unknown types and newer protocols", () => {
    const state: ChatRunReplayState = { cursor: 2, snapshot: snapshot("running", 2) };

    expect(
      applyChatRunReplay(state, replay(2, [event(3, "running", "message.created")])),
    ).toMatchObject({
      requiresSnapshot: true,
      unsupportedProtocol: false,
    });
    expect(
      applyChatRunReplay(state, replay(2, [event(3, "running", "future.event")])),
    ).toMatchObject({
      requiresSnapshot: true,
      unsupportedProtocol: false,
    });
    expect(
      applyChatRunReplay(state, replay(2, [{ ...event(3, "running"), protocolVersion: 2 }])),
    ).toMatchObject({ requiresSnapshot: true, unsupportedProtocol: true });
  });
});

describe("replaceConversationRunSnapshot", () => {
  it("replaces the run-owned message set while retaining unrelated conversation history", () => {
    const prior: Message = { id: "prior-1", role: "assistant", content: "Earlier" };
    const stale: Message = { id: "stale-1", role: "assistant", content: "Stale", run_id: "run-1" };
    const current: Message = {
      id: "assistant-1",
      role: "assistant",
      content: "Done",
      run_id: "run-1",
    };
    const authoritative = snapshot("succeeded", 5, [current]);

    expect(
      replaceConversationRunSnapshot(
        { id: "conversation-1", title: "Conversation", messages: [prior, stale] },
        authoritative,
      ),
    ).toMatchObject({ latest_run: { status: "succeeded" }, messages: [prior, current] });
  });
});
