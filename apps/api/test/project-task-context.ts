import {
  workspaceRoleSchema,
  type ProjectCapabilityKind,
  type ProjectTask,
  type ProjectFlowWait,
} from "@ngriffin_uk/polychat-schemas";
import { Miniflare } from "miniflare";
import { vi } from "vitest";

import type { Teammate } from "~/infrastructure/database/schema";
import type { ProjectRow } from "~/modules/workspaces/infrastructure/WorkspaceRepository";

import {
  initialiseProjectWorkDatabase,
  projectWorkTestContext,
  projectWorkTestEnvironment,
} from "./helpers/project-work-database";
import { projectTaskFixture } from "./project-task-fixtures";

const runtime = new Miniflare({
  modules: true,
  script: "export default { fetch() { return new Response('test'); } }",
  compatibilityDate: "2026-08-01",
  d1Databases: ["DB"],
});
const environment = (async () => {
  const database = await runtime.getD1Database("DB");

  await initialiseProjectWorkDatabase(database);
  await database.batch([
    database.prepare(
      "INSERT INTO user (id, email, plan_id) VALUES (7, 'runner@example.test', 'pro')",
    ),
    database.prepare(
      "INSERT INTO workspace (id, name, created_by) VALUES ('workspace-1', 'Runtime workspace', 7)",
    ),
    database.prepare(
      "INSERT INTO workspace_member (workspace_id, user_id, role) VALUES ('workspace-1', 7, 'owner')",
    ),
    database.prepare(
      "INSERT INTO project (id, workspace_id, name, created_by) VALUES ('project-1', 'workspace-1', 'Runtime project', 7)",
    ),
    database.prepare(
      "INSERT INTO teammates (id, user_id, name, servers) VALUES ('teammate-1', 7, 'Teammate', '[]')",
    ),
  ]);

  return projectWorkTestEnvironment(database);
})();

export async function disposeProjectTaskTestRuntime() {
  await environment;
  await runtime.dispose();
}

export async function createProjectTaskTestContext(
  overrides: {
    task?: Partial<ProjectTask>;
    flow?: string | null;
    role?: string;
    memberships?: Record<number, boolean>;
    capabilities?: { kind: ProjectCapabilityKind; capability_id: string }[];
    teammate?: Partial<Teammate> | null;
    activeCount?: number;
    boardTasks?: Partial<ProjectTask>[];
    project?: Partial<ProjectRow>;
  } = {},
) {
  const context = await projectWorkTestContext(await environment, 7);
  const task = projectTaskFixture(overrides.task);
  const project = await context.repositories.workspaces.getProject("project-1");
  const workspace = await context.repositories.workspaces.getWorkspace("workspace-1");
  const membership = await context.repositories.workspaces.getMembership("workspace-1", 7);
  const teammate = await context.repositories.teammates.getTeammateById("teammate-1");

  if (!project || !workspace || !membership || !teammate) {
    throw new Error("Runtime fixtures were not initialised");
  }

  const getProject = vi
    .spyOn(context.repositories.workspaces, "getProject")
    .mockResolvedValue({ ...project, flow: overrides.flow ?? null, ...overrides.project });
  const saveFlow = context.repositories.projectRecordTriggers.saveFlow.bind(
    context.repositories.projectRecordTriggers,
  );

  vi.spyOn(context.repositories.projectRecordTriggers, "saveFlow").mockImplementation(
    async (id, userId, flow) => {
      const saved = await saveFlow(id, userId, flow);

      if (saved) {
        getProject.mockResolvedValue({
          ...project,
          ...overrides.project,
          flow: flow ? JSON.stringify(flow) : null,
        });
      }

      return saved;
    },
  );
  vi.spyOn(context.repositories.workspaces, "getWorkspace").mockResolvedValue(workspace);
  vi.spyOn(context.repositories.workspaces, "getMembership").mockImplementation(
    async (_id, userId) =>
      (overrides.memberships ?? { 7: true })[userId]
        ? {
            ...membership,
            user_id: userId,
            role: workspaceRoleSchema.parse(overrides.role ?? "owner"),
          }
        : null,
  );
  vi.spyOn(context.repositories.workspaces, "listProjectCapabilities").mockResolvedValue(
    (overrides.capabilities ?? []).map((capability) => ({
      ...capability,
      id: capability.capability_id,
      project_id: "project-1",
      configuration: "{}",
      excluded: 0,
      created_by: 7,
      created_at: "2026-01-01T00:00:00.000Z",
    })),
  );
  vi.spyOn(context.repositories.teammates, "getTeammateById").mockResolvedValue(
    overrides.teammate ? { ...teammate, ...overrides.teammate } : null,
  );
  vi.spyOn(context.repositories.teammates, "listWorkspaceDefaults").mockResolvedValue([]);
  vi.spyOn(context.repositories.projectTasks, "getTaskById").mockResolvedValue(task);
  vi.spyOn(context.repositories.projectTasks, "listProjectTasks").mockResolvedValue(
    overrides.boardTasks?.map((item) => projectTaskFixture(item)) ?? [task],
  );
  vi.spyOn(context.repositories.projectTasks, "getMaxPosition").mockResolvedValue(0);
  vi.spyOn(context.repositories.projectTasks, "countActiveTasks").mockResolvedValue(
    overrides.activeCount ?? 0,
  );
  vi.spyOn(context.repositories.projectTasks, "createTask").mockResolvedValue(task);
  const updateTask = vi
    .spyOn(context.repositories.projectTasks, "updateTask")
    .mockImplementation(async (_id, updates) => ({ ...task, ...updates }));

  vi.spyOn(context.repositories.audit, "createRecord").mockResolvedValue(undefined);
  const createConversation = vi
    .spyOn(context.repositories.conversations, "createConversation")
    .mockResolvedValue({ id: "task_task-1" });

  vi.spyOn(context.repositories.conversations, "getConversation").mockResolvedValue(null);
  vi.spyOn(
    context.repositories.connectorOperationApprovals,
    "listConsumedRunIds",
  ).mockResolvedValue(new Set());
  const wait: ProjectFlowWait = {
    id: "wait",
    taskId: task.id,
    nodeId: task.flowExecution.nodeId,
    epoch: 1,
    step: 1,
    attempt: 1,
    name: "Work",
    kind: "agent",
    status: "dispatched",
    revision: 1,
    assignedUserId: null,
    dueAt: null,
    executionId: task.dispatchTaskId,
    payload: {},
    response: null,
    error: null,
    createdAt: task.createdAt,
    updatedAt: task.createdAt,
    resolvedAt: null,
  };

  vi.spyOn(context.repositories.projectFlows, "getWait").mockResolvedValue(wait);

  return { context, updateTask, createConversation };
}
