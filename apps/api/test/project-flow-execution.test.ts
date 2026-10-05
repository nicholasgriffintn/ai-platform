import {
  createAdhocProjectFlow,
  projectFlowSchema,
  type ProjectTask,
} from "@ngriffin_uk/polychat-schemas";
import { Miniflare } from "miniflare";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  createProjectTask,
  startProjectTask,
  setProjectFlow,
  updateProjectTask,
} from "~/modules/project-tasks/application";
import {
  driveProjectFlow,
  recordProjectTaskResumeFailure,
  resolveHumanFlowWait,
} from "~/modules/project-tasks/application/flow-execution";
import { runProjectFlowFunction } from "~/modules/project-tasks/application/flow-functions";
import { recoverProjectFlows } from "~/modules/project-tasks/application/flow-recovery";
import { scheduleRecordTriggeredTasks } from "~/modules/project-tasks/application/record-triggers";
import {
  createNativeRecord,
  listNativeRecordChanges,
  listNativeRecords,
} from "~/modules/records/application/records";
import { createNativeRecordTable } from "~/modules/records/application/tables";

import {
  initialiseProjectWorkDatabase,
  projectWorkTestContext,
  projectWorkTestEnvironment,
} from "./helpers/project-work-database";

const runtime = new Miniflare({
  modules: true,
  script: "export default { fetch() { return new Response('test'); } }",
  compatibilityDate: "2026-08-01",
  d1Databases: ["DB"],
});
let owner: ServiceContext;
let member: ServiceContext;

beforeAll(async () => {
  const database = await runtime.getD1Database("DB");

  await initialiseProjectWorkDatabase(database);
  const env = projectWorkTestEnvironment(database);

  owner = await projectWorkTestContext(env, 1);
  member = await projectWorkTestContext(env, 2);
});
beforeEach(async () => {
  await owner.env.DB.prepare("DELETE FROM project_record_trigger").run();
  await owner.env.DB.prepare("UPDATE project SET flow = NULL WHERE id = 'project'").run();
});
afterAll(async () => {
  vi.useRealTimers();
  await runtime.dispose();
});

async function claimFunction(task: ProjectTask) {
  if (!task.dispatchTaskId) {
    throw new Error("The function was not dispatched");
  }

  const token = crypto.randomUUID();

  await owner.env.DB.prepare(`UPDATE tasks SET status = 'running', execution_owner_token = ?,
    execution_lease_expires_at = ? WHERE id = ?`)
    .bind(token, new Date(Date.now() + 3_600_000).toISOString(), task.dispatchTaskId)
    .run();
  const claimed = await owner.repositories.projectTasks.claimQueuedTask({
    taskId: task.id,
    projectId: task.projectId,
    runnerIdentityUserId: 1,
    dispatchTaskId: task.dispatchTaskId,
    executionOwnerToken: token,
  });

  if (!claimed) {
    throw new Error("The function lease was not claimed");
  }

  return {
    task: claimed,
    executionOwner: { dispatchTaskId: task.dispatchTaskId, ownerToken: token },
  };
}

async function sharedTable() {
  return createNativeRecordTable(owner, {
    title: "Flow records",
    projectId: "project",
    definition: {
      format: "records",
      visibility: "shared",
      editing: "shared",
      columns: [{ id: "name", name: "Name", type: "text", maxLength: 5000, required: true }],
    },
  });
}

describe("persisted project flow execution", () => {
  it("requires the assigned reviewer, validates answers, deduplicates replies and resumes a timer as the original runner", async () => {
    const flow = projectFlowSchema.parse({
      version: 1,
      entryNodeId: "review",
      nodes: [
        {
          id: "review",
          name: "Review budget",
          type: "human_wait",
          prompt: "Confirm the budget",
          assigneeUserId: 2,
          fields: [{ id: "budget", name: "Budget", type: "number", minimum: 0, required: true }],
          onAccepted: "decision",
          onRejected: "cancelled",
        },
        {
          id: "decision",
          name: "Check budget",
          type: "decision",
          condition: { variable: "budget", operator: "gte", value: 100 },
          onTrue: "timer",
          onFalse: "cancelled",
        },
        { id: "timer", name: "Pause", type: "timer", seconds: 1, next: "done" },
        { id: "done", name: "Done", type: "end", status: "done" },
        { id: "cancelled", name: "Cancelled", type: "end", status: "cancelled" },
      ],
    });

    await setProjectFlow(owner, "project", flow);
    const created = await createProjectTask(owner, "project", {
      objective: "Review spending",
      assigneeUserId: 2,
    });
    const waiting = (await startProjectTask(owner, "project", created.task.id)).task;
    const wait = waiting.flowExecution.waitId
      ? await owner.repositories.projectFlows.getWait(waiting.flowExecution.waitId)
      : null;

    if (!wait) {
      throw new Error("The review was not persisted");
    }

    const input = {
      expectedRevision: wait.revision,
      resolution: "accepted" as const,
      values: { budget: 120 },
    };

    await expect(
      resolveHumanFlowWait(member, "project", waiting.id, wait.id, {
        ...input,
        values: { budget: -1 },
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    await owner.env.DB.prepare(
      "UPDATE workspace_member SET role = 'member' WHERE user_id = 1 AND workspace_id = 'workspace'",
    ).run();
    await expect(
      resolveHumanFlowWait(owner, "project", waiting.id, wait.id, input),
    ).rejects.toMatchObject({ statusCode: 403 });
    await owner.env.DB.prepare(
      "UPDATE workspace_member SET role = 'owner' WHERE user_id = 1 AND workspace_id = 'workspace'",
    ).run();
    const resolved = await resolveHumanFlowWait(member, "project", waiting.id, wait.id, input);

    expect(resolved.task).toMatchObject({
      runnerIdentityUserId: 1,
      status: "blocked",
      blockedReason: "awaiting_timer",
    });
    await resolveHumanFlowWait(member, "project", waiting.id, wait.id, input);
    await expect(
      resolveHumanFlowWait(member, "project", waiting.id, wait.id, {
        ...input,
        resolution: "rejected",
        values: {},
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 2000);
    try {
      await recoverProjectFlows(owner.env);
    } finally {
      vi.useRealTimers();
    }

    const complete = await owner.repositories.projectTasks.getTaskById(waiting.id);

    expect(complete).toMatchObject({ status: "done", runnerIdentityUserId: 1 });
    const history = await owner.repositories.projectFlows.history(waiting.id, 0, {
      projectId: "project",
      actorUserId: 1,
    });

    expect(
      history.events.filter((event) => event.kind === "resumed" && event.waitId === wait.id),
    ).toHaveLength(1);
  });

  it("reuses a persisted record request after a crash and stops a bounded loop at its configured limit", async () => {
    const table = await sharedTable();
    const flow = projectFlowSchema.parse({
      version: 1,
      entryNodeId: "repeat",
      nodes: [
        {
          id: "repeat",
          name: "Repeat twice",
          type: "loop",
          maxIterations: 2,
          body: "create",
          exit: "done",
        },
        {
          id: "create",
          name: "Create a record",
          type: "function",
          operation: {
            kind: "create_record",
            tableId: table.output.id,
            values: { name: "Loop record" },
            outputIdKey: "last_record",
          },
          next: "repeat",
        },
        { id: "done", name: "Done", type: "end", status: "done" },
      ],
    });

    await setProjectFlow(owner, "project", flow);
    const created = await createProjectTask(owner, "project", { objective: "Create two records" });

    await setProjectFlow(owner, "project", createAdhocProjectFlow());
    const first = await claimFunction(await driveProjectFlow(owner, created.task));
    const wait = first.task.flowExecution.waitId
      ? await owner.repositories.projectFlows.getWait(first.task.flowExecution.waitId)
      : null;

    if (
      !wait ||
      typeof wait.payload.requestId !== "string" ||
      typeof wait.payload.tableRevision !== "number"
    ) {
      throw new Error("The record request was not captured");
    }

    await createNativeRecord(
      owner,
      table.output.id,
      {
        requestId: wait.payload.requestId,
        tableRevision: wait.payload.tableRevision,
        values: { name: "Loop record" },
      },
      undefined,
      {
        ...first.executionOwner,
        taskId: first.task.id,
        flowRevision: first.task.flowRevision,
        waitId: wait.id,
      },
    );
    const second = await claimFunction(
      await runProjectFlowFunction(owner, first.task, first.executionOwner),
    );
    const finished = await runProjectFlowFunction(owner, second.task, second.executionOwner);

    expect(finished.status).toBe("done");
    expect(
      (await listNativeRecords(owner, table.output.id, { filters: [], limit: 100, offset: 0 }))
        .records,
    ).toHaveLength(2);
    expect((await listNativeRecordChanges(owner, table.output.id, 0)).changes).toHaveLength(2);
    await expect(
      runProjectFlowFunction(owner, first.task, first.executionOwner),
    ).rejects.toBeDefined();
  });

  it("prevents a cancelled worker from writing a record or advancing its checkpoint", async () => {
    const table = await sharedTable();
    const flow = projectFlowSchema.parse({
      version: 1,
      entryNodeId: "create",
      nodes: [
        {
          id: "create",
          name: "Create",
          type: "function",
          operation: {
            kind: "create_record",
            tableId: table.output.id,
            values: { name: "Cancelled" },
          },
          next: "done",
        },
        { id: "done", name: "Done", type: "end", status: "done" },
      ],
    });

    await setProjectFlow(owner, "project", flow);
    const created = await createProjectTask(owner, "project", {
      objective: "Cancel before the write",
    });
    const claimed = await claimFunction(await driveProjectFlow(owner, created.task));

    await updateProjectTask(owner, "project", created.task.id, { status: "cancelled" });
    expect(
      await recordProjectTaskResumeFailure(
        owner,
        claimed.task,
        "A stale reply could not resume the task",
      ),
    ).toBeNull();
    await expect(
      runProjectFlowFunction(owner, claimed.task, claimed.executionOwner),
    ).rejects.toBeDefined();
    expect((await listNativeRecordChanges(owner, table.output.id, 0)).changes).toHaveLength(0);
    expect((await owner.repositories.projectTasks.getTaskById(created.task.id))?.status).toBe(
      "cancelled",
    );
  });

  it("creates one task per record event under concurrent scheduling and suppresses changes made by triggered tasks", async () => {
    const table = await sharedTable();
    const flow = projectFlowSchema.parse({
      version: 1,
      entryNodeId: "create",
      recordTriggers: [
        {
          id: "created",
          name: "Process new records",
          tableId: table.output.id,
          operations: ["created"],
          objective: "Process the new record",
          entryNodeId: "create",
          saveFields: { source_name: "name" },
        },
      ],
      nodes: [
        {
          id: "create",
          name: "Create follow-up",
          type: "function",
          operation: {
            kind: "create_record",
            tableId: table.output.id,
            values: { name: "Follow-up" },
          },
          next: "done",
        },
        { id: "done", name: "Done", type: "end", status: "done" },
      ],
    });

    await setProjectFlow(owner, "project", flow);
    await createNativeRecord(owner, table.output.id, {
      requestId: crypto.randomUUID(),
      tableRevision: 1,
      values: { name: "Source" },
    });
    await Promise.all([
      scheduleRecordTriggeredTasks(owner.env),
      scheduleRecordTriggeredTasks(owner.env),
    ]);
    const tasks = (await owner.repositories.projectTasks.listProjectTasks("project")).filter(
      (task) =>
        task.source === "record_trigger" &&
        task.flowSnapshot.recordTriggers.some((trigger) => trigger.tableId === table.output.id),
    );

    expect(tasks).toHaveLength(1);
    const triggered = tasks[0];

    if (!triggered) {
      throw new Error("The triggered task was not created");
    }

    const claimed = await claimFunction(triggered);

    await runProjectFlowFunction(owner, claimed.task, claimed.executionOwner);
    await scheduleRecordTriggeredTasks(owner.env);
    const journal = await listNativeRecordChanges(owner, table.output.id, 0);

    expect(journal.changes.map((change) => change.triggerEligible)).toEqual([true, false]);
    expect(
      (await owner.repositories.projectTasks.listProjectTasks("project")).filter(
        (task) =>
          task.source === "record_trigger" &&
          task.flowSnapshot.recordTriggers.some((trigger) => trigger.tableId === table.output.id),
      ),
    ).toHaveLength(1);
  });
});
