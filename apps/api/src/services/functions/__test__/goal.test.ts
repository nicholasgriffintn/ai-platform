import type { Goal } from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { complete_goal, set_goal } from "../goal";

function createGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: "goal-1",
    conversation_id: "conversation-1",
    sandbox_run_id: null,
    user_id: 1,
    objective: "Make the checkout suite pass",
    status: "active",
    source: "user",
    iteration_count: 1,
    stall_streak: 0,
    tokens_spent: 0,
    progress: [],
    evidence: null,
    stopped_reason: null,
    created_at: "2026-08-19T00:00:00.000Z",
    updated_at: null,
    completed_at: null,
    last_continued_at: null,
    ...overrides,
  };
}

const addMessage = vi.fn();

function createContext(
  options: {
    goal?: Goal | null;
    messages?: any[];
    conversationType?: "conversation" | "task";
  } = {},
) {
  let current = options.goal === undefined ? createGoal() : options.goal;
  const messages = options.messages ?? [
    { role: "assistant", content: "Here is the answer", timestamp: Date.now() },
  ];

  return {
    conversationManager: { add: addMessage },
    request: {
      user: { id: 1, plan_id: "pro" },
      request: {
        completion_id: "conversation-1",
        conversation_type: options.conversationType,
      },
      context: {
        repositories: {
          goals: {
            getActiveGoal: vi.fn(async () => current),
            getGoalById: vi.fn(async () => current),
            updateGoal: vi.fn(async (_id: string, updates: any) => {
              current = { ...current, ...(updates.status ? { status: updates.status } : {}) };

              return current;
            }),
            createGoal: vi.fn(async (params: any) => {
              current = createGoal({ objective: params.objective, source: params.source });

              return current;
            }),
            listGoals: vi.fn(),
          },
          messages: {
            getConversationMessages: vi.fn(async () => messages),
          },
        },
      },
    },
  } as any;
}

describe("complete_goal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("leaves the completion marker to the turn, so it lands after the tool result", async () => {
    const result = await complete_goal.execute(
      {
        summary: "Suite is green",
        evidence: [
          {
            claim: "Checkout suite passes",
            route: "ran the suite",
            evidence_surface: "tool result",
            status: "confirmed",
          },
        ],
      },
      createContext({ goal: createGoal({ iteration_count: 2 }) }),
    );

    expect(result.status).toBe("success");
    expect(addMessage).not.toHaveBeenCalled();
  });

  it("refuses to complete before the turn has produced anything", async () => {
    const result = await complete_goal.execute(
      {
        summary: "Done already",
        evidence: [
          {
            claim: "Nothing yet",
            route: "none",
            evidence_surface: "none",
            status: "confirmed",
          },
        ],
      },
      createContext({ messages: [{ role: "user", content: "do it", timestamp: Date.now() }] }),
    );

    expect(result.status).toBe("error");
    expect(addMessage).not.toHaveBeenCalled();
  });

  it("completes once the assistant has answered", async () => {
    const result = await complete_goal.execute(
      {
        summary: "Answered",
        evidence: [
          {
            claim: "Returned the JSON",
            route: "answered in this turn",
            evidence_surface: "assistant message",
            status: "confirmed",
          },
        ],
      },
      createContext(),
    );

    expect(result.status).toBe("success");
  });

  it("does not let a project task complete before producing its stage deliverable", async () => {
    const result = await complete_goal.execute(
      {
        summary: "Stage deliverable complete",
        evidence: [
          {
            claim: "The stage acceptance criterion is met",
            route: "ran the stage validation",
            evidence_surface: "tool result",
            status: "confirmed",
          },
        ],
      },
      createContext({
        conversationType: "task",
        messages: [{ role: "user", content: "do it", timestamp: Date.now() }],
      }),
    );

    expect(result.status).toBe("error");
  });

  it("does not let a project task call a failed tool successful evidence", async () => {
    const now = Date.now();
    const result = await complete_goal.execute(
      {
        summary: "Connector validation passed",
        evidence: [
          {
            claim: "The connector worked",
            route: "called the connector",
            evidence_surface: "tool result",
            status: "confirmed",
          },
        ],
      },
      createContext({
        conversationType: "task",
        messages: [
          { role: "assistant", content: "Stage deliverable", timestamp: now },
          {
            role: "tool",
            name: "use_recipe_connector",
            status: "error",
            content: "Connector unavailable",
            timestamp: now + 1,
          },
        ],
      }),
    );

    expect(result.status).toBe("error");
    expect(result.content).toContain("still failing");
  });

  it("lets a project task report an unresolved stage as blocked", async () => {
    const now = Date.now();
    const result = await complete_goal.execute(
      {
        summary: "Connector validation is blocked",
        evidence: [
          {
            claim: "The connector is available",
            route: "called the connector",
            evidence_surface: "tool error",
            status: "blocked",
            remaining_uncertainty: "The connector is not enabled.",
          },
        ],
      },
      createContext({
        conversationType: "task",
        messages: [
          { role: "assistant", content: "Stage blocker report", timestamp: now },
          {
            role: "tool",
            name: "use_recipe_connector",
            status: "error",
            content: "Connector unavailable",
            timestamp: now + 1,
          },
        ],
      }),
    );

    expect(result.status).toBe("success");
    expect(result.content).toContain("blocked");
  });

  it("requires a real pending question instead of treating prose as a human block", async () => {
    const result = await complete_goal.execute(
      {
        summary: "Waiting for the product name",
        evidence: [
          {
            claim: "The product name is known",
            route: "asked in an assistant message",
            evidence_surface: "assistant message",
            status: "blocked",
            remaining_uncertainty: "The user has not answered yet.",
          },
        ],
      },
      createContext({
        conversationType: "task",
        messages: [
          {
            role: "assistant",
            content: "What product name should I use?",
            timestamp: Date.now(),
          },
        ],
      }),
    );

    expect(result.status).toBe("error");
    expect(result.content).toContain("Call ask_user");
  });

  it("completes with a real evidence ledger", async () => {
    const result = await complete_goal.execute(
      {
        summary: "Suite is green",
        evidence: [
          {
            claim: "checkout suite passes",
            route: "ran pnpm test",
            evidence_surface: "tool result",
            status: "confirmed",
          },
        ],
      },
      createContext(),
    );

    expect(result.status).toBe("success");
    expect(result.content).toContain("Goal completed");
  });

  it("refuses to complete without evidence", async () => {
    const result = await complete_goal.execute(
      { summary: "trust me, it works", evidence: [] },
      createContext(),
    );

    expect(result.status).toBe("error");
    expect(result.content).toContain("evidence ledger");
  });

  it("records an all-blocked ledger as blocked rather than complete", async () => {
    const result = await complete_goal.execute(
      {
        summary: "The benchmark will not run here",
        evidence: [
          {
            claim: "p95 under 120ms",
            route: "tried to run the benchmark",
            evidence_surface: "command output",
            status: "blocked",
          },
        ],
      },
      createContext(),
    );

    expect(result.content).toContain("blocked");
  });

  it("errors when there is no active goal", async () => {
    const result = await complete_goal.execute(
      {
        summary: "done",
        evidence: [
          {
            claim: "a claim",
            route: "a route",
            evidence_surface: "a surface",
            status: "confirmed",
          },
        ],
      },
      createContext({ goal: null }),
    );

    expect(result.status).toBe("error");
    expect(result.content).toContain("no active goal");
  });

  it("does not complete a paused goal", async () => {
    const result = await complete_goal.execute(
      {
        summary: "done",
        evidence: [
          {
            claim: "a claim",
            route: "a route",
            evidence_surface: "a surface",
            status: "confirmed",
          },
        ],
      },
      createContext({ goal: createGoal({ status: "paused" }) }),
    );

    expect(result.status).toBe("error");
    expect(result.content).toContain("no active goal");
  });
});

describe("set_goal", () => {
  it("stores the objective the model was asked to pursue", async () => {
    const result = await set_goal.execute(
      { objective: "Keep the branch green" },
      createContext({ goal: null }),
    );

    expect(result.status).toBe("success");
    expect(result.content).toContain("Keep the branch green");
  });
});
