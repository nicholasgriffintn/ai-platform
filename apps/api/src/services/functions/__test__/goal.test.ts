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
    iteration_count: 0,
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

function createContext(options: { goal?: Goal | null; delegationStack?: string[] } = {}) {
  let current = options.goal === undefined ? createGoal() : options.goal;

  return {
    request: {
      user: { id: 1, plan_id: "pro" },
      request: {
        completion_id: "conversation-1",
        delegation_stack: options.delegationStack,
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
        },
      },
    },
  } as any;
}

describe("complete_goal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it("stops a delegated agent from completing the delegating thread's goal", async () => {
    const result = await complete_goal.execute(
      {
        summary: "I did my bit",
        evidence: [
          {
            claim: "handled the task",
            route: "delegated work",
            evidence_surface: "tool result",
            status: "confirmed",
          },
        ],
      },
      createContext({ delegationStack: ["agent-1"] }),
    );

    expect(result.status).toBe("error");
    expect(result.content).toContain("delegated agent cannot complete the goal");
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
