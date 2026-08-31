import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectTaskRepository } from "../ProjectTaskRepository";

let sqlite: Database.Database;

function createD1Database(database: Database.Database) {
  return {
    prepare: vi.fn((query: string) => ({
      bind: (...params: unknown[]) => {
        const statement = database.prepare(query);

        return {
          first: async () => statement.get(...params) ?? null,
          all: async () => ({ results: statement.all(...params) }),
          run: async () => {
            const result = statement.run(...params);

            return { success: true, meta: { changes: result.changes } };
          },
        };
      },
    })),
  };
}

function insertRunningTask(id: string, dispatchTaskId: string): void {
  sqlite
    .prepare(
      `INSERT INTO project_task (
         id, project_id, workspace_id, objective, status, source,
         runner_identity_user_id, dispatch_task_id
       ) VALUES (?, 'project-1', 'workspace-1', 'Prove the target', 'running', 'user', 7, ?)`,
    )
    .run(id, dispatchTaskId);
}

function insertBacklogTask(id: string): void {
  sqlite
    .prepare(
      `INSERT INTO project_task (
         id, project_id, workspace_id, objective, status, source
       ) VALUES (?, 'project-1', 'workspace-1', 'Prove the target', 'backlog', 'user')`,
    )
    .run(id);
}

beforeEach(() => {
  sqlite = new Database(":memory:");
  sqlite.exec(`
    CREATE TABLE project_task (
      id text PRIMARY KEY NOT NULL,
      project_id text NOT NULL,
      workspace_id text NOT NULL,
      objective text NOT NULL,
      acceptance_criteria text DEFAULT '[]',
      expected_output text,
      context text,
      constraints text,
      depends_on_task_ids text DEFAULT '[]',
      require_approval_for text DEFAULT '[]',
      status text DEFAULT 'backlog' NOT NULL,
      source text DEFAULT 'user' NOT NULL,
      blocked_reason text,
      blocked_detail text,
      stage_id text,
      runner text,
      created_by_user_id integer DEFAULT 7 NOT NULL,
      assignee_user_id integer,
      runner_identity_user_id integer,
      conversation_id text,
      goal_id text,
      sandbox_run_id text,
      output_id text,
      projection_claim_id text,
      idempotency_key text,
      dispatch_task_id text,
      completions text DEFAULT '[]',
      position real DEFAULT 0 NOT NULL,
      token_budget integer,
      tokens_spent integer DEFAULT 0 NOT NULL,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text,
      started_at text,
      completed_at text
    );
    CREATE UNIQUE INDEX project_task_sandbox_run_idx
      ON project_task (sandbox_run_id)
      WHERE sandbox_run_id IS NOT NULL;
    CREATE UNIQUE INDEX project_task_idempotency_idx
      ON project_task (project_id, created_by_user_id, idempotency_key)
      WHERE idempotency_key IS NOT NULL;
  `);
});

describe("ProjectTaskRepository terminal projection", () => {
  it("claims one exact run before terminal side effects and finalises only that claim", async () => {
    insertRunningTask("task-1", "dispatch-1");
    sqlite
      .prepare(
        "UPDATE project_task SET sandbox_run_id = 'run-1', goal_id = 'goal-1' WHERE id = 'task-1'",
      )
      .run();
    const repository = new ProjectTaskRepository({ DB: createD1Database(sqlite) } as any);
    const linkage = {
      taskId: "task-1",
      projectId: "project-1",
      workspaceId: "workspace-1",
      runnerIdentityUserId: 7,
      dispatchTaskId: "dispatch-1",
      sandboxRunId: "run-1",
      goalId: "goal-1",
      projectionClaimId: "claim-1",
    };

    await expect(repository.claimSandboxRunProjection(linkage)).resolves.toBe(true);
    await expect(
      repository.claimSandboxRunProjection({ ...linkage, projectionClaimId: "claim-2" }),
    ).resolves.toBe(false);
    await expect(
      repository.projectSandboxRunResult({
        ...linkage,
        outputId: null,
        status: "blocked",
        blockedReason: "run_failed",
        blockedDetail: "Run failed",
        completions: [],
        tokensSpent: 0,
      }),
    ).resolves.toMatchObject({ status: "blocked" });
  });

  it("gives a projection lease to only one caller, even when claim tokens match", async () => {
    insertRunningTask("task-1", "dispatch-1");
    sqlite
      .prepare(
        "UPDATE project_task SET sandbox_run_id = 'run-1', goal_id = 'goal-1' WHERE id = 'task-1'",
      )
      .run();
    const repository = new ProjectTaskRepository({ DB: createD1Database(sqlite) } as any);
    const linkage = {
      taskId: "task-1",
      projectId: "project-1",
      workspaceId: "workspace-1",
      runnerIdentityUserId: 7,
      dispatchTaskId: "dispatch-1",
      sandboxRunId: "run-1",
      goalId: "goal-1",
      projectionClaimId: "claim-1",
    };

    const claims = await Promise.all([
      repository.claimSandboxRunProjection(linkage),
      repository.claimSandboxRunProjection(linkage),
    ]);

    expect(claims.filter(Boolean)).toHaveLength(1);
  });

  it("does not let cancellation overtake an owned terminal projection", async () => {
    insertRunningTask("task-1", "dispatch-1");
    sqlite
      .prepare(
        "UPDATE project_task SET sandbox_run_id = 'run-1', goal_id = 'goal-1' WHERE id = 'task-1'",
      )
      .run();
    const repository = new ProjectTaskRepository({ DB: createD1Database(sqlite) } as any);
    const linkage = {
      taskId: "task-1",
      projectId: "project-1",
      workspaceId: "workspace-1",
      runnerIdentityUserId: 7,
      dispatchTaskId: "dispatch-1",
      sandboxRunId: "run-1",
      goalId: "goal-1",
      projectionClaimId: "claim-1",
    };

    await expect(repository.claimSandboxRunProjection(linkage)).resolves.toBe(true);
    await expect(
      repository.updateTask(
        "task-1",
        { status: "cancelled" },
        { expectedStatuses: ["running"], requireProjectionUnclaimed: true },
      ),
    ).resolves.toBeNull();
    await expect(
      repository.projectSandboxRunResult({
        ...linkage,
        outputId: null,
        status: "blocked",
        blockedReason: "run_failed",
        blockedDetail: "Run failed",
        completions: [],
        tokensSpent: 0,
      }),
    ).resolves.toMatchObject({ status: "blocked" });
  });

  it("releases a failed projection attempt so an exact delivery can repair it", async () => {
    insertRunningTask("task-1", "dispatch-1");
    sqlite
      .prepare(
        "UPDATE project_task SET sandbox_run_id = 'run-1', goal_id = 'goal-1' WHERE id = 'task-1'",
      )
      .run();
    const repository = new ProjectTaskRepository({ DB: createD1Database(sqlite) } as any);
    const linkage = {
      taskId: "task-1",
      projectId: "project-1",
      workspaceId: "workspace-1",
      runnerIdentityUserId: 7,
      dispatchTaskId: "dispatch-1",
      sandboxRunId: "run-1",
      goalId: "goal-1",
    };

    await expect(
      repository.claimSandboxRunProjection({ ...linkage, projectionClaimId: "claim-1" }),
    ).resolves.toBe(true);
    await expect(
      repository.releaseSandboxRunProjection({ ...linkage, projectionClaimId: "claim-1" }),
    ).resolves.toBe(true);
    await expect(
      repository.claimSandboxRunProjection({ ...linkage, projectionClaimId: "claim-2" }),
    ).resolves.toBe(true);
  });

  it("lets redelivery replace an abandoned projection lease", async () => {
    insertRunningTask("task-1", "dispatch-1");
    sqlite
      .prepare(
        "UPDATE project_task SET sandbox_run_id = 'run-1', goal_id = 'goal-1' WHERE id = 'task-1'",
      )
      .run();
    const repository = new ProjectTaskRepository({ DB: createD1Database(sqlite) } as any);
    const linkage = {
      taskId: "task-1",
      projectId: "project-1",
      workspaceId: "workspace-1",
      runnerIdentityUserId: 7,
      dispatchTaskId: "dispatch-1",
      sandboxRunId: "run-1",
      goalId: "goal-1",
    };

    await expect(
      repository.claimSandboxRunProjection({ ...linkage, projectionClaimId: "claim-1" }),
    ).resolves.toBe(true);
    sqlite
      .prepare("UPDATE project_task SET updated_at = '2000-01-01 00:00:00' WHERE id = 'task-1'")
      .run();
    await expect(
      repository.claimSandboxRunProjection({ ...linkage, projectionClaimId: "claim-2" }),
    ).resolves.toBe(true);
  });

  it("scopes idempotency keys to the project and creator", async () => {
    const repository = new ProjectTaskRepository({ DB: createD1Database(sqlite) } as any);
    const input = {
      projectId: "project-1",
      workspaceId: "workspace-1",
      objective: "Prove the target",
      source: "user" as const,
      createdByUserId: 7,
      idempotencyKey: "proof-request-1",
      position: 1000,
    };

    const created = await repository.createTask(input);

    await expect(
      repository.getTaskByIdempotencyKey({
        projectId: "project-1",
        createdByUserId: 7,
        idempotencyKey: "proof-request-1",
      }),
    ).resolves.toMatchObject({ id: created.id });
    await expect(repository.createTask(input)).rejects.toThrow("Error executing database query");
  });
});

afterEach(() => {
  sqlite.close();
});

describe("ProjectTaskRepository.attachSandboxRun", () => {
  it("allows one exact attachment and rejects duplicate run ownership", async () => {
    insertRunningTask("task-1", "dispatch-1");
    insertRunningTask("task-2", "dispatch-2");
    const repository = new ProjectTaskRepository({ DB: createD1Database(sqlite) } as any);

    await expect(
      repository.attachSandboxRun({
        taskId: "task-1",
        projectId: "project-1",
        workspaceId: "workspace-1",
        runnerIdentityUserId: 7,
        dispatchTaskId: "dispatch-1",
        sandboxRunId: "run-1",
        goalId: "goal-1",
      }),
    ).resolves.toMatchObject({ id: "task-1", sandboxRunId: "run-1", goalId: "goal-1" });

    await expect(
      repository.attachSandboxRun({
        taskId: "task-1",
        projectId: "project-1",
        workspaceId: "workspace-1",
        runnerIdentityUserId: 7,
        dispatchTaskId: "dispatch-1",
        sandboxRunId: "run-2",
        goalId: "goal-2",
      }),
    ).resolves.toBeNull();

    await expect(
      repository.attachSandboxRun({
        taskId: "task-2",
        projectId: "project-1",
        workspaceId: "workspace-1",
        runnerIdentityUserId: 7,
        dispatchTaskId: "dispatch-2",
        sandboxRunId: "run-1",
        goalId: "goal-2",
      }),
    ).rejects.toThrow("Error executing database query");
  });
});

describe("ProjectTaskRepository queue admission", () => {
  it("atomically admits only one task into the final project concurrency slot", async () => {
    insertRunningTask("running-1", "dispatch-running-1");
    insertRunningTask("running-2", "dispatch-running-2");
    insertBacklogTask("candidate-1");
    insertBacklogTask("candidate-2");
    const repository = new ProjectTaskRepository({ DB: createD1Database(sqlite) } as any);
    const queue = (taskId: string) =>
      repository.queueTaskForRun({
        taskId,
        projectId: "project-1",
        runnerIdentityUserId: 7,
        dispatchTaskId: `dispatch-${taskId}`,
        runner: { kind: "conversation" as const, agentId: null, model: null, mode: null },
        tokenBudget: 1000,
      });

    const admitted = await Promise.all([queue("candidate-1"), queue("candidate-2")]);

    expect(admitted.filter(Boolean)).toHaveLength(1);
    expect(await repository.countActiveTasks("project-1")).toBe(3);
  });
});

describe("ProjectTaskRepository deletion", () => {
  it("does not delete a task that became queued after the caller read it", async () => {
    insertBacklogTask("task-1");
    sqlite.prepare("UPDATE project_task SET status = 'queued' WHERE id = 'task-1'").run();
    const repository = new ProjectTaskRepository({ DB: createD1Database(sqlite) } as any);

    await expect(repository.deleteTask("task-1", "backlog")).resolves.toBe(false);
    await expect(repository.getTaskById("task-1")).resolves.toMatchObject({ status: "queued" });
  });
});
