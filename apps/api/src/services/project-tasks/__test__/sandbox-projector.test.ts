import type {
  Goal,
  LeanProofResult,
  ProjectTask,
  SandboxRunData,
  SandboxRunDispatchMessage,
} from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/lib/context/serviceContext";
import type { ActivityRecord } from "~/repositories/ActivityRepository";
import type { OutputRecord } from "~/repositories/OutputRepository";
import { assertSandboxGitHubAuthority } from "~/services/sandbox/worker";

import {
  assertCurrentSandboxProjectTaskAuthority,
  projectSandboxRunToProjectTask,
} from "../sandbox-projector";

vi.mock("~/services/sandbox/worker", () => ({
  assertSandboxGitHubAuthority: vi.fn(),
}));

const dispatchContext = {
  dispatchTaskId: "dispatch-1",
  taskId: "task-1",
  projectId: "project-1",
  workspaceId: "workspace-1",
  runnerIdentityUserId: 7,
};

const request = {
  targetPaths: ["Main.lean"],
  declarations: ["Main.theorem"],
  objective: "Prove Main.theorem",
  acceptanceCriteria: ["Kernel check passes"],
};

const proofResult: LeanProofResult = {
  outcome: "kernel_checked",
  summary: "Main.theorem passed the kernel check.",
  targetPaths: ["Main.lean"],
  declarations: ["Main.theorem"],
  changedPaths: ["Main.lean"],
  diagnostics: [],
  evidence: [
    {
      kind: "kernel",
      status: "passed",
      summary: "Lean accepted Main.theorem without disallowed axioms.",
      path: "Main.lean",
      declaration: "Main.theorem",
    },
  ],
  usage: {
    inputTokens: 120,
    outputTokens: 30,
    totalTokens: 150,
    cachedInputTokens: 0,
    iterations: 2,
  },
};

const task: ProjectTask = {
  id: "task-1",
  projectId: "project-1",
  workspaceId: "workspace-1",
  objective: request.objective,
  acceptanceCriteria: [],
  expectedOutput: null,
  context: null,
  constraints: null,
  dependsOnTaskIds: [],
  requireApprovalFor: [],
  status: "running",
  source: "user",
  blockedReason: null,
  blockedDetail: null,
  stageId: null,
  runner: { kind: "sandbox", profile: "lean-proof", request },
  createdByUserId: 7,
  assigneeUserId: null,
  runnerIdentityUserId: 7,
  conversationId: null,
  goalId: "goal-1",
  sandboxRunId: "run-1",
  outputId: null,
  dispatchTaskId: "dispatch-1",
  completions: [],
  position: 1000,
  tokenBudget: 1000,
  tokensSpent: 10,
  createdAt: "2026-08-31T10:00:00.000Z",
  updatedAt: null,
  startedAt: "2026-08-31T10:00:01.000Z",
  completedAt: null,
};

const goal: Goal = {
  id: "goal-1",
  conversation_id: null,
  sandbox_run_id: "run-1",
  user_id: 7,
  objective: request.objective,
  status: "completed",
  source: "user",
  iteration_count: 2,
  stall_streak: 0,
  tokens_spent: 150,
  progress: [],
  evidence: [
    {
      claim: "Lean accepted Main.theorem without disallowed axioms.",
      route: "kernel",
      evidence_surface: "Main.lean",
      status: "confirmed",
    },
  ],
  stopped_reason: proofResult.summary,
  created_at: "2026-08-31T10:00:01.000Z",
  updated_at: "2026-08-31T10:02:00.000Z",
  completed_at: "2026-08-31T10:02:00.000Z",
  last_continued_at: "2026-08-31T10:01:00.000Z",
};

const run: SandboxRunData = {
  runId: "run-1",
  installationId: 42,
  repo: "owner/repo",
  task: request.objective,
  taskType: "lean-proof",
  model: "labs-leanstral-1-5",
  trustLevel: "balanced",
  promptStrategy: "auto",
  shouldCommit: true,
  status: "completed",
  startedAt: "2026-08-31T10:00:01.000Z",
  updatedAt: "2026-08-31T10:02:00.000Z",
  completedAt: "2026-08-31T10:02:00.000Z",
  leanProof: request,
  tokenBudget: 990,
  projectTaskContext: dispatchContext,
  result: { success: true, leanProof: proofResult, usage: proofResult.usage },
};

const message: SandboxRunDispatchMessage = {
  kind: "sandbox_run_dispatch",
  runId: "run-1",
  recordId: "record-1",
  userId: 7,
  payload: {
    installationId: 42,
    repo: "owner/repo",
    task: request.objective,
    taskType: "lean-proof",
    model: "labs-leanstral-1-5",
    promptStrategy: "auto",
    shouldCommit: true,
    trustLevel: "balanced",
    leanProof: request,
    tokenBudget: 990,
    projectTaskContext: dispatchContext,
  },
};

const record: ActivityRecord = {
  id: "record-1",
  created_by_user_id: 7,
  project_id: "project-1",
  conversation_id: null,
  capability_id: "sandbox_runs",
  group_id: "run-1",
  kind: "sandbox_run",
  status: "succeeded",
  summary: request.objective,
  data: JSON.stringify(run),
  created_at: run.startedAt,
  updated_at: run.updatedAt,
};

const outputRecord: OutputRecord = {
  id: "lean-proof-run-1",
  created_by_user_id: 7,
  project_id: "project-1",
  conversation_id: null,
  parent_output_id: null,
  capability_id: "featured-lean-proofs",
  group_id: "run-1",
  kind: "lean.proof",
  title: "Lean proof: Main.lean",
  status: "ready",
  sensitivity: "internal",
  content: JSON.stringify(proofResult),
  storage_key: null,
  mime_type: null,
  filename: null,
  byte_size: null,
  revision: 1,
  created_at: run.completedAt ?? run.updatedAt,
  updated_at: null,
};

function createContext(overrides: { task?: ProjectTask; goal?: Goal } = {}) {
  const getTaskById = vi.fn().mockResolvedValue(overrides.task ?? task);
  const projectSandboxRunResult = vi.fn().mockImplementation(async (input) => ({
    ...(overrides.task ?? task),
    ...input,
  }));
  const createOutputOnce = vi.fn().mockResolvedValue(outputRecord);
  const claimSandboxRunProjection = vi.fn().mockResolvedValue(true);
  const releaseSandboxRunProjection = vi.fn().mockResolvedValue(true);

  return {
    context: {
      repositories: {
        projectTasks: {
          getTaskById,
          projectSandboxRunResult,
          claimSandboxRunProjection,
          releaseSandboxRunProjection,
        },
        goals: { getGoalById: vi.fn().mockResolvedValue(overrides.goal ?? goal) },
        outputs: { createOutputOnce },
      },
    } as unknown as ServiceContext,
    getTaskById,
    projectSandboxRunResult,
    createOutputOnce,
    claimSandboxRunProjection,
    releaseSandboxRunProjection,
  };
}

describe("projectSandboxRunToProjectTask", () => {
  it("projects kernel-backed proof evidence to human review exactly once", async () => {
    const runtime = createContext();

    await expect(
      projectSandboxRunToProjectTask({
        context: runtime.context,
        message,
        record,
        run,
      }),
    ).resolves.toBe("projected");

    expect(runtime.createOutputOnce).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "lean-proof-run-1",
        projectId: "project-1",
        content: proofResult,
      }),
    );
    expect(runtime.claimSandboxRunProjection).toHaveBeenCalledBefore(runtime.createOutputOnce);
    expect(runtime.projectSandboxRunResult).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "review",
        blockedReason: null,
        outputId: "lean-proof-run-1",
        tokensSpent: 160,
        completions: [
          expect.objectContaining({
            runtime: "sandbox",
            sandboxRunId: "run-1",
            outputId: "lean-proof-run-1",
            approval: expect.objectContaining({ mode: "human", status: "pending" }),
          }),
        ],
      }),
    );
  });

  it("does not mutate the goal or output until it owns the terminal projection", async () => {
    const runtime = createContext();

    runtime.claimSandboxRunProjection.mockResolvedValue(false);

    await expect(
      projectSandboxRunToProjectTask({ context: runtime.context, message, record, run }),
    ).resolves.toBe("stale");
    expect(runtime.createOutputOnce).not.toHaveBeenCalled();
    expect(runtime.projectSandboxRunResult).not.toHaveBeenCalled();
  });

  it("releases its projection lease when a side effect fails so redelivery can repair it", async () => {
    const runtime = createContext();

    runtime.createOutputOnce.mockRejectedValueOnce(new Error("Output store unavailable"));

    await expect(
      projectSandboxRunToProjectTask({ context: runtime.context, message, record, run }),
    ).rejects.toThrow("Output store unavailable");
    expect(runtime.releaseSandboxRunProjection).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: task.id,
        sandboxRunId: run.runId,
        projectionClaimId: expect.any(String),
      }),
    );
  });

  it("treats an exact replay as a truthful duplicate without writing again", async () => {
    const completion = {
      id: "lean-proof-completion-run-1",
      stageId: null,
      runtime: "sandbox" as const,
      conversationId: null,
      goalId: "goal-1",
      sandboxRunId: "run-1",
      outputId: "lean-proof-run-1",
      output: proofResult.summary,
      evidence: [],
      approval: {
        mode: "human" as const,
        status: "pending" as const,
        reviewedByUserId: null,
        reviewedAt: null,
      },
      createdAt: run.completedAt ?? run.updatedAt,
    };
    const runtime = createContext({
      task: { ...task, status: "review", outputId: "lean-proof-run-1", completions: [completion] },
    });

    await expect(
      projectSandboxRunToProjectTask({ context: runtime.context, message, record, run }),
    ).resolves.toBe("duplicate");
    expect(runtime.createOutputOnce).not.toHaveBeenCalled();
    expect(runtime.projectSandboxRunResult).not.toHaveBeenCalled();
  });

  it("fails closed when a stale delivery names another dispatch attempt", async () => {
    const runtime = createContext();
    const staleMessage = {
      ...message,
      payload: {
        ...message.payload,
        projectTaskContext: { ...dispatchContext, dispatchTaskId: "dispatch-stale" },
      },
    };

    await expect(
      projectSandboxRunToProjectTask({
        context: runtime.context,
        message: staleMessage,
        record,
        run,
      }),
    ).resolves.toBe("stale");
    expect(runtime.getTaskById).not.toHaveBeenCalled();
    expect(runtime.createOutputOnce).not.toHaveBeenCalled();
  });

  it("blocks incomplete proof work separately from operational failures", async () => {
    const incomplete = {
      ...proofResult,
      outcome: "incomplete" as const,
      summary: "One target still has an unsolved goal.",
      evidence: [{ ...proofResult.evidence[0], status: "failed" as const }],
    };
    const runtime = createContext({ goal: { ...goal, status: "blocked" } });

    await projectSandboxRunToProjectTask({
      context: runtime.context,
      message,
      record,
      run: {
        ...run,
        status: "failed",
        error: incomplete.summary,
        result: {
          success: false,
          error: incomplete.summary,
          leanProof: incomplete,
          usage: incomplete.usage,
        },
      },
    });

    expect(runtime.projectSandboxRunResult).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "blocked",
        blockedReason: "verification_failed",
        completions: [],
      }),
    );
    expect(runtime.createOutputOnce).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", content: incomplete }),
    );
  });

  it("projects structured token-budget exhaustion with its non-retryable task reason", async () => {
    const summary = "Lean proof stopped at its 990-token budget.";
    const incomplete = {
      ...proofResult,
      outcome: "incomplete" as const,
      summary,
      evidence: [{ ...proofResult.evidence[0], status: "warning" as const }],
    };
    const runtime = createContext({ goal: { ...goal, status: "blocked" } });

    await expect(
      projectSandboxRunToProjectTask({
        context: runtime.context,
        message,
        record,
        run: {
          ...run,
          status: "failed",
          error: summary,
          result: {
            success: false,
            error: summary,
            leanProof: incomplete,
            usage: incomplete.usage,
          },
        },
      }),
    ).resolves.toBe("projected");
    expect(runtime.projectSandboxRunResult).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "blocked",
        blockedReason: "token_budget",
        blockedDetail: summary,
        completions: [],
      }),
    );
    expect(runtime.createOutputOnce).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", content: incomplete }),
    );
  });

  it("never sends a successful verifier result to review with an uncompleted goal", async () => {
    const runtime = createContext({ goal: { ...goal, status: "blocked" } });

    await projectSandboxRunToProjectTask({ context: runtime.context, message, record, run });

    expect(runtime.projectSandboxRunResult).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "blocked",
        blockedReason: "run_failed",
        completions: [],
      }),
    );
  });
});

describe("assertCurrentSandboxProjectTaskAuthority", () => {
  function createAuthorityContext(projectOverrides: Record<string, unknown> = {}) {
    vi.mocked(assertSandboxGitHubAuthority).mockClear();

    return {
      repositories: {
        projectTasks: { getTaskById: vi.fn().mockResolvedValue(task) },
        workspaces: {
          getProject: vi.fn().mockResolvedValue({
            id: "project-1",
            workspace_id: "workspace-1",
            coding_enabled: 1,
            coding_installation_id: 42,
            coding_repository: "owner/repo",
            ...projectOverrides,
          }),
          getMembership: vi.fn().mockResolvedValue({ role: "member" }),
          listProjectCapabilities: vi
            .fn()
            .mockResolvedValue([{ kind: "app", capability_id: "featured-lean-proofs" }]),
        },
      },
    } as unknown as ServiceContext;
  }

  it("revalidates membership, capability, coding environment and credential owner", async () => {
    const context = createAuthorityContext();

    await expect(
      assertCurrentSandboxProjectTaskAuthority({
        context,
        message,
        record,
        run,
        user: { id: 7, plan_id: "pro" } as any,
      }),
    ).resolves.toBeUndefined();
    expect(assertSandboxGitHubAuthority).toHaveBeenCalledWith({
      context,
      userId: 7,
      repo: "owner/repo",
      installationId: 42,
    });
  });

  it("fails closed when the run identity loses Pro access after enqueue", async () => {
    const context = createAuthorityContext();

    await expect(
      assertCurrentSandboxProjectTaskAuthority({
        context,
        message,
        record,
        run,
        user: { id: 7, plan_id: "free" } as any,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(assertSandboxGitHubAuthority).not.toHaveBeenCalled();
  });

  it("fails closed when the project's coding environment changed after enqueue", async () => {
    const context = createAuthorityContext({ coding_repository: "owner/other-repo" });

    await expect(
      assertCurrentSandboxProjectTaskAuthority({
        context,
        message,
        record,
        run,
        user: { id: 7, plan_id: "pro" } as any,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(assertSandboxGitHubAuthority).not.toHaveBeenCalled();
  });
});
