import type { Goal } from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AssistantError } from "~/utils/errors";

import { GoalService } from "../GoalService";

const proUser = { id: 1, plan_id: "pro" } as any;
const freeUser = { id: 2, plan_id: "free" } as any;

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

function createRepository(goal: Goal | null = createGoal()) {
  let current = goal;

  return {
    getActiveGoal: vi.fn(async () => current),
    getGoalById: vi.fn(async () => current),
    listGoals: vi.fn(async () => (current ? [current] : [])),
    createGoal: vi.fn(async (params: any) => {
      current = createGoal({ objective: params.objective, source: params.source });

      return current;
    }),
    updateGoal: vi.fn(async (_id: string, updates: any) => {
      current = {
        ...current,
        ...(updates.status !== undefined ? { status: updates.status } : {}),
        ...(updates.objective !== undefined ? { objective: updates.objective } : {}),
        ...(updates.stallStreak !== undefined ? { stall_streak: updates.stallStreak } : {}),
        ...(updates.iterationCount !== undefined
          ? { iteration_count: updates.iterationCount }
          : {}),
        ...(updates.tokensSpent !== undefined ? { tokens_spent: updates.tokensSpent } : {}),
        ...(updates.progress !== undefined ? { progress: updates.progress } : {}),
        ...(updates.evidence !== undefined ? { evidence: updates.evidence } : {}),
        ...(updates.stoppedReason !== undefined ? { stopped_reason: updates.stoppedReason } : {}),
      };

      return current;
    }),
  } as any;
}

describe("GoalService", () => {
  let repository: ReturnType<typeof createRepository>;
  let service: GoalService;

  beforeEach(() => {
    repository = createRepository();
    service = new GoalService(repository);
  });

  it("refuses to set a goal for a user without Pro", async () => {
    await expect(
      service.setGoal({
        owner: { conversationId: "conversation-1" },
        user: freeUser,
        objective: "Do the thing",
        source: "user",
      }),
    ).rejects.toBeInstanceOf(AssistantError);
  });

  it("replaces an existing objective in place and clears the stall streak", async () => {
    repository = createRepository(createGoal({ stall_streak: 1 }));
    service = new GoalService(repository);

    const goal = await service.setGoal({
      owner: { conversationId: "conversation-1" },
      user: proUser,
      objective: "A sharper objective",
      source: "user",
    });

    expect(repository.createGoal).not.toHaveBeenCalled();
    expect(goal.objective).toBe("A sharper objective");
    expect(goal.stall_streak).toBe(0);
  });

  it("only lets each actor make its own transitions", async () => {
    await expect(
      service.transition({ goalId: "goal-1", actor: "model", status: "paused" }),
    ).rejects.toThrow(/may not move a goal to paused/);

    await expect(
      service.transition({ goalId: "goal-1", actor: "user", status: "completed" }),
    ).rejects.toThrow(/may not move a goal to completed/);

    await expect(
      service.transition({ goalId: "goal-1", actor: "user", status: "paused" }),
    ).resolves.toMatchObject({ status: "paused" });
  });

  it("refuses to reopen a goal that already ended", async () => {
    repository = createRepository(createGoal({ status: "completed" }));
    service = new GoalService(repository);

    await expect(
      service.transition({ goalId: "goal-1", actor: "user", status: "paused" }),
    ).rejects.toThrow(/already ended as completed/);
  });

  it("rejects completion without an evidence ledger", async () => {
    await expect(
      service.completeGoal({ goalId: "goal-1", evidence: [], summary: "trust me" }),
    ).rejects.toThrow(/requires an evidence ledger/);
  });

  it("refuses to complete a paused goal", async () => {
    repository = createRepository(createGoal({ status: "paused" }));
    service = new GoalService(repository);

    await expect(
      service.completeGoal({
        goalId: "goal-1",
        summary: "Done",
        evidence: [
          {
            claim: "The work is complete",
            route: "checked the result",
            evidence_surface: "tool result",
            status: "confirmed",
          },
        ],
      }),
    ).rejects.toThrow(/is paused/);
  });

  it("treats a ledger with a blocked dependency as blocked rather than complete", async () => {
    const goal = await service.completeGoal({
      goalId: "goal-1",
      summary: "Could not reach the benchmark",
      evidence: [
        {
          claim: "p95 under 120ms",
          route: "ran the benchmark",
          evidence_surface: "benchmark output",
          status: "blocked",
        },
        {
          claim: "benchmark binary exists",
          route: "checked the workspace",
          evidence_surface: "file listing",
          status: "confirmed",
        },
      ],
    });

    expect(goal.status).toBe("blocked");
  });

  it("completes when the ledger carries real evidence", async () => {
    const goal = await service.completeGoal({
      goalId: "goal-1",
      summary: "Suite is green",
      evidence: [
        {
          claim: "checkout suite passes",
          route: "ran pnpm test",
          evidence_surface: "tool result",
          status: "confirmed",
        },
      ],
    });

    expect(goal.status).toBe("completed");
  });

  it("ends a goal that stops producing evidence", async () => {
    repository = createRepository(createGoal({ stall_streak: 1 }));
    service = new GoalService(repository);

    const result = await service.recordIteration({
      goalId: "goal-1",
      iteration: {
        surface: "chat",
        summary: "Read the same file again",
        producedEvidence: false,
        calledTool: false,
      },
    });

    expect(result.shouldContinue).toBe(false);
    expect(result.goal.status).toBe("stalled");
    expect(result.transitioned).toBe(true);
  });

  it("keeps a productive goal running and records the journal entry", async () => {
    const result = await service.recordIteration({
      goalId: "goal-1",
      iteration: {
        surface: "chat",
        summary: "Ran the suite, two failures left",
        evidence: ["tool:run_command"],
        next: "Fix the currency rounding case",
        tokens: 1200,
        producedEvidence: true,
        calledTool: true,
      },
    });

    expect(result.shouldContinue).toBe(true);
    expect(result.goal.status).toBe("active");
    expect(result.goal.iteration_count).toBe(1);
    expect(result.goal.tokens_spent).toBe(1200);
    expect(result.transitioned).toBe(false);
    expect(result.goal.progress.at(-1)).toMatchObject({
      summary: "Ran the suite, two failures left",
      next: "Fix the currency rounding case",
    });
  });

  it("does not record progress after the exact goal has been paused", async () => {
    repository = createRepository(createGoal({ status: "paused" }));
    service = new GoalService(repository);

    const result = await service.recordIteration({
      goalId: "goal-1",
      iteration: {
        surface: "chat",
        summary: "This arrived after the pause",
        producedEvidence: true,
        calledTool: true,
      },
    });

    expect(result).toMatchObject({
      goal: { status: "paused" },
      shouldContinue: false,
      transitioned: false,
    });
    expect(repository.updateGoal).not.toHaveBeenCalled();
  });

  it("does not overwrite a concurrent terminal transition", async () => {
    const active = createGoal();
    const completed = createGoal({ status: "completed" });

    repository.getGoalById.mockResolvedValueOnce(active).mockResolvedValueOnce(completed);
    repository.updateGoal.mockResolvedValueOnce(null);

    const result = await service.recordIteration({
      goalId: active.id,
      iteration: {
        surface: "chat",
        summary: "Progress arrived during completion",
        producedEvidence: true,
        calledTool: true,
      },
    });

    expect(repository.updateGoal).toHaveBeenCalledWith(active.id, expect.any(Object), {
      expectedStatus: "active",
    });
    expect(result).toEqual({
      goal: completed,
      shouldContinue: false,
      transitioned: false,
    });
  });

  it("records a steer and resets the stall streak", async () => {
    repository = createRepository(createGoal({ stall_streak: 1 }));
    service = new GoalService(repository);

    const goal = await service.steer({
      goalId: "goal-1",
      instruction: "Check the staging config too",
      surface: "chat",
    });

    expect(goal.stall_streak).toBe(0);
    expect(goal.progress.at(-1)).toMatchObject({ steer: "Check the staging config too" });
  });
});

describe("run-owned goals", () => {
  it("keeps a run goal and its conversation's goal independent", async () => {
    const runRepository = createRepository(
      createGoal({ id: "run-goal", conversation_id: null, sandbox_run_id: "run-1" }),
    );
    const runService = new GoalService(runRepository);

    const runGoal = await runService.getActiveGoal({ sandboxRunId: "run-1" });

    expect(runGoal).toMatchObject({ sandbox_run_id: "run-1", conversation_id: null });
    expect(runRepository.getActiveGoal).toHaveBeenCalledWith({ sandboxRunId: "run-1" });
  });

  it("promotes a run task into an objective without touching the conversation", async () => {
    const runRepository = createRepository(null);
    const runService = new GoalService(runRepository);

    const goal = await runService.setGoal({
      owner: { sandboxRunId: "run-2" },
      user: proUser,
      objective: "Make the checkout suite pass on this branch",
      source: "user",
    });

    expect(goal.objective).toBe("Make the checkout suite pass on this branch");
    expect(runRepository.createGoal).toHaveBeenCalledWith(
      expect.objectContaining({ owner: { sandboxRunId: "run-2" } }),
    );
  });
});
