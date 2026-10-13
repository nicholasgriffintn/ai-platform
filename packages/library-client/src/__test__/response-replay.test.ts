import type { Message } from "@ngriffin_uk/polychat-library-chat/conversation-types";
import type {
  PlatformResponse,
  ResponseEventRecord,
  ResponseStatus,
} from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import {
  applyResponseReplay,
  replaceConversationResponseSnapshot,
  type AppResponseReplayResponse,
  type AuthoritativeResponseSnapshot,
  type ResponseReplayState,
} from "../chat/response-replay.js";

function response(status: ResponseStatus, attempt = 1): PlatformResponse {
  return {
    object: "response",
    id: "resp-1",
    conversation_id: "conversation-1",
    status,
    waiting_on: null,
    attempt,
    trigger: "user",
    initiator_user_id: 7,
    project_id: null,
    project_task_id: null,
    created_at: "2026-09-05T12:00:00.000Z",
    updated_at: "2026-09-05T12:00:01.000Z",
    started_at: "2026-09-05T12:00:01.000Z",
    completed_at: null,
    terminal_reason: null,
    last_item_id: null,
  };
}

function snapshot(
  status: ResponseStatus,
  cursor: number,
  messages: Message[] = [],
): AuthoritativeResponseSnapshot {
  return { ...response(status), cursor, messages };
}

function event(
  sequence: number,
  status: ResponseStatus,
  type = "response.status_changed",
): ResponseEventRecord {
  return {
    id: `event-${sequence}`,
    response_id: "resp-1",
    sequence,
    attempt: 1,
    type,
    occurred_at: `2026-09-05T12:00:0${sequence}.000Z`,
    data: { status },
  };
}

function replay(
  fromCursor: number,
  events: ResponseEventRecord[],
  overrides: Partial<AppResponseReplayResponse> = {},
): AppResponseReplayResponse {
  return {
    response_id: "resp-1",
    from_cursor: fromCursor,
    next_cursor: events.at(-1)?.sequence ?? fromCursor,
    reset_required: false,
    events,
    snapshot: null,
    ...overrides,
  };
}

describe("applyResponseReplay", () => {
  it("replays retry state without changing the attempt", () => {
    const state: ResponseReplayState = { cursor: 1, snapshot: snapshot("in_progress", 1) };
    const retryEvent: ResponseEventRecord = {
      ...event(2, "in_progress", "response.retry_changed"),
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

    const waiting = applyResponseReplay(state, replay(1, [retryEvent]));
    const cleared = applyResponseReplay(
      waiting.state,
      replay(2, [{ ...retryEvent, sequence: 3, id: "event-3", data: { retry: null } }]),
    );

    expect(waiting.state.snapshot).toMatchObject({
      attempt: 1,
      retry: { attempt: 2, phase: "waiting" },
    });
    expect(cleared.state.snapshot.retry).toBeNull();
  });

  it("deduplicates and orders events without regressing terminal state", () => {
    const state: ResponseReplayState = { cursor: 1, snapshot: snapshot("in_progress", 1) };
    const outcome = applyResponseReplay(
      state,
      replay(1, [event(3, "cancelled"), event(2, "cancelling"), event(2, "cancelling")]),
    );

    expect(outcome.requiresSnapshot).toBe(false);
    expect(outcome.state.cursor).toBe(3);
    expect(outcome.state.snapshot.status).toBe("cancelled");

    const stale = applyResponseReplay(outcome.state, replay(3, [event(4, "in_progress")]));

    expect(stale.state.cursor).toBe(4);
    expect(stale.state.snapshot.status).toBe("cancelled");
  });

  it("asks for a snapshot when a sequence gap or unknown event appears", () => {
    const state: ResponseReplayState = { cursor: 1, snapshot: snapshot("in_progress", 1) };

    expect(applyResponseReplay(state, replay(1, [event(3, "completed")])).requiresSnapshot).toBe(
      true,
    );
    expect(
      applyResponseReplay(state, replay(1, [event(2, "completed", "response.effect")]))
        .requiresSnapshot,
    ).toBe(true);
  });

  it("adopts the snapshot a reset carries", () => {
    const state: ResponseReplayState = { cursor: 1, snapshot: snapshot("in_progress", 1) };
    const outcome = applyResponseReplay(
      state,
      replay(1, [], { reset_required: true, snapshot: snapshot("completed", 9) }),
    );

    expect(outcome.requiresSnapshot).toBe(false);
    expect(outcome.state).toEqual({ cursor: 9, snapshot: snapshot("completed", 9) });
  });
});

describe("replaceConversationResponseSnapshot", () => {
  it("replaces the response's messages while keeping other conversation messages", () => {
    const conversation = {
      id: "conversation-1",
      title: "Chat",
      messages: [
        { id: "m1", role: "user", content: "hi" },
        { id: "m2", role: "assistant", content: "partial", run_id: "resp-1" },
      ] as Message[],
    };
    const updated = replaceConversationResponseSnapshot(
      conversation,
      snapshot("completed", 4, [
        { id: "m2", role: "assistant", content: "final", run_id: "resp-1" },
        { id: "m3", role: "tool", content: "result", run_id: "resp-1" },
      ]),
    );

    expect(updated.messages.map((message) => [message.id, message.content])).toEqual([
      ["m1", "hi"],
      ["m2", "final"],
      ["m3", "result"],
    ]);
    expect(updated.latest_response).toMatchObject({ id: "resp-1", status: "completed" });
    expect(updated.latest_response).not.toHaveProperty("messages");
  });
});
