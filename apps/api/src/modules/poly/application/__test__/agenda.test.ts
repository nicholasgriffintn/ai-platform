import {
  CHAT_RUN_PROTOCOL_VERSION,
  chatRunSchema,
  delegationSchema,
  goalSchema,
  type Delegation,
} from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { buildPolyAgenda } from "../agenda";

const NOW = Date.parse("2026-10-05T12:00:00.000Z");

function delegation(id: string, state: Delegation["state"], updatedAt: string): Delegation {
  return delegationSchema.parse({
    id,
    parentConversationId: "teammate_home_poly",
    childConversationId: `child_${id}`,
    parentRunId: "run_parent",
    depth: 1,
    teammateId: "teammate_research",
    goal: `Goal ${id}`,
    waitFor: "none",
    budget: { maxCreditMicros: 1000, maxSteps: 10, deadline: "2026-10-06T00:00:00.000Z" },
    state,
    result: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt,
  });
}

function goal(status: string) {
  return goalSchema.parse({
    id: "goal_1",
    conversation_id: "teammate_home_poly",
    sandbox_run_id: null,
    user_id: 7,
    objective: "Ship the launch notes",
    status,
    source: "user",
    iteration_count: 2,
    stall_streak: 0,
    tokens_spent: 0,
    progress: [],
    evidence: null,
    stopped_reason: null,
    created_at: "2026-10-05T09:00:00.000Z",
    updated_at: "2026-10-05T11:00:00.000Z",
    completed_at: null,
    last_continued_at: null,
  });
}

function run(status: string) {
  return chatRunSchema.parse({
    protocolVersion: CHAT_RUN_PROTOCOL_VERSION,
    id: "run_latest",
    conversationId: "teammate_home_poly",
    projectId: null,
    projectTaskId: null,
    initiatorUserId: 7,
    status,
    attempt: 1,
    createdAt: "2026-10-05T11:30:00.000Z",
    updatedAt: "2026-10-05T11:31:00.000Z",
    startedAt: null,
    completedAt: null,
    terminalReason: null,
    lastMessageId: null,
  });
}

describe("buildPolyAgenda", () => {
  it("sorts the thread's work into needs you, working on and done this week", () => {
    const agenda = buildPolyAgenda({
      conversationId: "teammate_home_poly",
      delegations: [
        delegation("waiting", "awaiting_approval", "2026-10-05T10:00:00.000Z"),
        delegation("running", "running", "2026-10-05T10:30:00.000Z"),
        delegation("finished", "done", "2026-10-03T10:00:00.000Z"),
        delegation("stale", "done", "2026-09-20T10:00:00.000Z"),
        delegation("dropped", "cancelled", "2026-10-05T10:00:00.000Z"),
      ],
      goal: goal("active"),
      latestRun: run("awaiting_input"),
      noted: [],
      now: NOW,
    });

    expect(agenda.needs_you.map((item) => [item.kind, item.id])).toEqual([
      ["question", "run_latest"],
      ["delegation", "waiting"],
    ]);
    expect(agenda.working_on.map((item) => [item.kind, item.id])).toEqual([
      ["goal", "goal_1"],
      ["delegation", "running"],
    ]);
    expect(agenda.done.map((item) => item.id)).toEqual(["finished"]);
    expect(agenda.needs_you[1]?.conversation_id).toBe("child_waiting");
  });

  it("raises a goal that stopped short and ignores one that completed", () => {
    const stalled = buildPolyAgenda({
      conversationId: "teammate_home_poly",
      delegations: [],
      goal: goal("stalled"),
      latestRun: run("succeeded"),
      noted: [],
      now: NOW,
    });
    const completed = buildPolyAgenda({
      conversationId: "teammate_home_poly",
      delegations: [],
      goal: goal("completed"),
      latestRun: null,
      noted: [],
      now: NOW,
    });

    expect(stalled.needs_you.map((item) => item.kind)).toEqual(["goal"]);
    expect(completed).toEqual({ needs_you: [], working_on: [], done: [], noted: [] });
  });

  it("caps each column so the agenda stays short", () => {
    const agenda = buildPolyAgenda({
      conversationId: "teammate_home_poly",
      delegations: Array.from({ length: 12 }, (_, index) =>
        delegation(
          `d${index}`,
          "running",
          `2026-10-05T10:${String(index).padStart(2, "0")}:00.000Z`,
        ),
      ),
      goal: null,
      latestRun: null,
      noted: [],
      now: NOW,
    });

    expect(agenda.working_on).toHaveLength(8);
    expect(agenda.working_on[0]?.id).toBe("d11");
  });
});
