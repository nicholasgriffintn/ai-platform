import { readFile } from "node:fs/promises";

import { Miniflare } from "miniflare";
import { describe, expect, it } from "vitest";

import { resolveHumanFlowWait } from "~/modules/project-tasks/application/flow-execution";

import { applyTestMigration } from "./helpers/migrations";
import {
  initialiseProjectWorkDatabase,
  projectWorkTestContext,
  projectWorkTestEnvironment,
} from "./helpers/project-work-database";

describe("existing task migration", () => {
  it("continues a pending review under its original runner while preserving the exact completed run", async () => {
    const runtime = new Miniflare({
      modules: true,
      script: "export default { fetch() { return new Response('test'); } }",
      compatibilityDate: "2026-08-01",
      d1Databases: ["DB"],
    });

    try {
      const database = await runtime.getD1Database("DB");

      await initialiseProjectWorkDatabase(database, "0062");
      const legacyFlow = JSON.stringify({
        stages: [
          {
            id: "spec",
            name: "Spec",
            instructions: null,
            teammateId: null,
            skillIds: [],
            mode: "plan",
            requiresApprovalFor: [],
            advance: "on_human_accept",
          },
          {
            id: "build",
            name: "Build",
            instructions: null,
            teammateId: null,
            skillIds: [],
            mode: "build",
            requiresApprovalFor: [],
            advance: "on_goal_complete",
          },
        ],
      });
      const completion = JSON.stringify([
        {
          id: "completion",
          stageId: "spec",
          conversationId: "conversation",
          goalId: "goal",
          runId: "run",
          runAttempt: 2,
          dispatchTaskId: "old-dispatch",
          outputIds: [],
          output: "Approved specification",
          evidence: [],
          approval: { mode: "human", status: "pending", reviewedByUserId: null, reviewedAt: null },
          createdAt: "2026-10-01T10:00:00.000Z",
        },
      ]);

      await database.batch([
        database.prepare("UPDATE project SET flow = ? WHERE id = 'project'").bind(legacyFlow),
        database.prepare(
          "INSERT INTO conversation (id, user_id, project_id) VALUES ('conversation', 1, 'project')",
        ),
        database
          .prepare(
            "INSERT INTO project_task (id, project_id, workspace_id, objective, status, stage_id, flow_snapshot, created_by_user_id, assignee_user_id, runner_identity_user_id, conversation_id, completions) VALUES ('task', 'project', 'workspace', 'Build the reviewed spec', 'review', 'spec', ?, 1, 2, 1, 'conversation', ?)",
          )
          .bind(legacyFlow, completion),
        database.prepare(
          "INSERT INTO conversation_run (id, conversation_id, project_id, project_task_id, stage_id, initiator_user_id, status, attempt, created_at, updated_at) VALUES ('run', 'conversation', 'project', 'task', 'spec', 1, 'succeeded', 2, '2026-10-01T10:00:00.000Z', '2026-10-01T10:00:00.000Z')",
        ),
        database.prepare("UPDATE project_task SET run_id = 'run' WHERE id = 'task'"),
      ]);
      await applyTestMigration(
        database,
        await readFile(
          new URL("../migrations/0062_project_flow_graph.sql", import.meta.url),
          "utf8",
        ),
      );
      const env = projectWorkTestEnvironment(database);
      const reviewer = await projectWorkTestContext(env, 2);
      const migrated = await reviewer.repositories.projectTasks.getTaskById("task");
      const wait = migrated?.flowExecution.waitId
        ? await reviewer.repositories.projectFlows.getWait(migrated.flowExecution.waitId)
        : null;

      if (!migrated || !wait) {
        throw new Error("The existing review checkpoint was lost");
      }

      const result = await resolveHumanFlowWait(reviewer, "project", "task", wait.id, {
        expectedRevision: wait.revision,
        resolution: "accepted",
        values: {},
      });

      expect(result.task).toMatchObject({
        status: "queued",
        nodeId: "legacy-agent-1",
        runnerIdentityUserId: 1,
      });
      expect(result.task.completions).toEqual([
        expect.objectContaining({
          runId: "run",
          runAttempt: 2,
          dispatchTaskId: "old-dispatch",
          approval: expect.objectContaining({
            status: "approved",
            reviewedByUserId: 2,
            reviewWaitId: wait.id,
          }),
        }),
      ]);
      expect(await reviewer.repositories.conversationRuns.getById("run")).toMatchObject({
        nodeId: "legacy-agent-0",
        attempt: 2,
        status: "succeeded",
      });
      expect(await reviewer.repositories.projectFlows.getWait(wait.id)).toMatchObject({
        status: "completed",
      });
    } finally {
      await runtime.dispose();
    }
  });
});
