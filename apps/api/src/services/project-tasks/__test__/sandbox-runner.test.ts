import { beforeEach, describe, expect, it, vi } from "vitest";

import { dispatchLeanProofProjectTask, resolveLeanProofTimeoutSeconds } from "../sandbox-runner";

const mocks = vi.hoisted(() => ({
  enqueuePreparedSandboxRun: vi.fn(),
  projectSandboxRunToProjectTask: vi.fn(),
}));

vi.mock("~/services/apps/sandbox/create-run", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/services/apps/sandbox/create-run")>();

  return { ...actual, enqueuePreparedSandboxRun: mocks.enqueuePreparedSandboxRun };
});
vi.mock("../sandbox-projector", () => ({
  projectSandboxRunToProjectTask: mocks.projectSandboxRunToProjectTask,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveLeanProofTimeoutSeconds", () => {
  it("leaves credential-renewal margin for long Lean proof runs", () => {
    expect(resolveLeanProofTimeoutSeconds(7200)).toBe(3300);
    expect(resolveLeanProofTimeoutSeconds(1800)).toBe(1800);
    expect(resolveLeanProofTimeoutSeconds(null)).toBeUndefined();
  });
});

describe("dispatchLeanProofProjectTask", () => {
  it("re-enqueues the exact attached run when the first handler died before queue send", async () => {
    const projectTaskContext = {
      dispatchTaskId: "dispatch-1",
      taskId: "task-1",
      projectId: "project-1",
      workspaceId: "workspace-1",
      runnerIdentityUserId: 7,
    };
    const task = {
      id: "task-1",
      projectId: "project-1",
      workspaceId: "workspace-1",
      runnerIdentityUserId: 7,
      dispatchTaskId: "dispatch-1",
      runner: {
        kind: "sandbox" as const,
        profile: "lean-proof" as const,
        request: {
          targetPaths: ["Main.lean"],
          declarations: [],
          objective: "Prove the target",
          acceptanceCriteria: [],
        },
      },
      sandboxRunId: "run-1",
      goalId: "goal-1",
    };
    const record = {
      id: "record-1",
      created_by_user_id: 7,
      project_id: "project-1",
      conversation_id: null,
      capability_id: "sandbox_runs",
      group_id: "run-1",
      kind: "sandbox_run",
      status: "queued",
      summary: "Prove the target",
      data: JSON.stringify({
        runId: "run-1",
        installationId: 42,
        repo: "owner/repo",
        task: "Prove the target",
        taskType: "lean-proof",
        model: "labs-leanstral-1-5",
        trustLevel: "balanced",
        promptStrategy: "auto",
        shouldCommit: true,
        status: "queued",
        startedAt: "2026-08-31T10:00:00.000Z",
        updatedAt: "2026-08-31T10:00:00.000Z",
        leanProof: task.runner.request,
        tokenBudget: 1000,
        projectTaskContext,
      }),
      created_at: "2026-08-31T10:00:00.000Z",
      updated_at: "2026-08-31T10:00:00.000Z",
    };
    const context = {
      env: {},
      repositories: {
        activities: { getActivityByGroup: vi.fn().mockResolvedValue(record) },
      },
    };

    await expect(
      dispatchLeanProofProjectTask({
        context: context as any,
        user: {} as any,
        task: task as any,
        project: {} as any,
      }),
    ).resolves.toEqual({ runId: "run-1", goalId: "goal-1" });
    expect(mocks.enqueuePreparedSandboxRun).toHaveBeenCalledWith(
      expect.objectContaining({
        context,
        projectId: "project-1",
        prepared: expect.objectContaining({
          record,
          message: expect.objectContaining({
            runId: "run-1",
            recordId: "record-1",
            payload: expect.objectContaining({ projectTaskContext }),
          }),
        }),
      }),
    );
  });

  it("fails closed when only one sandbox attachment anchor is present", async () => {
    const task = {
      runner: {
        kind: "sandbox" as const,
        profile: "lean-proof" as const,
        request: {
          targetPaths: ["Main.lean"],
          declarations: [],
          objective: "Prove the target",
          acceptanceCriteria: [],
        },
      },
      sandboxRunId: "run-1",
      goalId: null,
    };

    await expect(
      dispatchLeanProofProjectTask({
        context: {} as any,
        user: {} as any,
        task: task as any,
        project: {} as any,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("projects an attached terminal Activity left behind by an interrupted dispatcher", async () => {
    const projectTaskContext = {
      dispatchTaskId: "dispatch-1",
      taskId: "task-1",
      projectId: "project-1",
      workspaceId: "workspace-1",
      runnerIdentityUserId: 7,
    };
    const request = {
      targetPaths: ["Main.lean"],
      declarations: [],
      objective: "Prove the target",
      acceptanceCriteria: [],
    };
    const task = {
      id: "task-1",
      projectId: "project-1",
      workspaceId: "workspace-1",
      runnerIdentityUserId: 7,
      dispatchTaskId: "dispatch-1",
      runner: { kind: "sandbox" as const, profile: "lean-proof" as const, request },
      sandboxRunId: "run-1",
      goalId: "goal-1",
    };
    const run = {
      runId: "run-1",
      installationId: 42,
      repo: "owner/repo",
      task: "Prove the target",
      taskType: "lean-proof",
      model: "labs-leanstral-1-5",
      trustLevel: "balanced",
      shouldCommit: true,
      status: "failed",
      error: "Queue send failed",
      startedAt: "2026-08-31T10:00:00.000Z",
      updatedAt: "2026-08-31T10:00:01.000Z",
      completedAt: "2026-08-31T10:00:01.000Z",
      leanProof: request,
      tokenBudget: 1000,
      projectTaskContext,
    };
    const record = {
      id: "record-1",
      created_by_user_id: 7,
      project_id: "project-1",
      conversation_id: null,
      capability_id: "sandbox_runs",
      group_id: "run-1",
      kind: "sandbox_run",
      status: "failed",
      summary: "Prove the target",
      data: JSON.stringify(run),
      created_at: run.startedAt,
      updated_at: run.updatedAt,
    };
    const context = {
      env: {},
      repositories: {
        activities: { getActivityByGroup: vi.fn().mockResolvedValue(record) },
      },
    };

    await expect(
      dispatchLeanProofProjectTask({
        context: context as any,
        user: {} as any,
        task: task as any,
        project: {} as any,
      }),
    ).resolves.toEqual({ runId: "run-1", goalId: "goal-1" });
    expect(mocks.projectSandboxRunToProjectTask).toHaveBeenCalledWith(
      expect.objectContaining({
        context,
        record,
        run: expect.objectContaining({ status: "failed" }),
      }),
    );
    expect(mocks.enqueuePreparedSandboxRun).not.toHaveBeenCalled();
  });
});
