import { renderPrompt } from "@ngriffin_uk/polychat-ai-prompts";
import {
  isTerminalProjectTaskStatus,
  readToolIds,
  WORK_TEAMMATE_WAKE_TASK_TYPE,
  WORK_WAKE_QUIET_MINUTES,
  WORK_WATCHDOG_GRACE_MINUTES,
  type ProjectTask,
  type WorkTeammateWakeTaskData,
  type WorkWakeReason,
} from "@ngriffin_uk/polychat-schemas";
import { generateId, MINUTE_MS, parseStoredTimestamp } from "@ngriffin_uk/polychat-utility-core";

import { createServiceContext, type ServiceContext } from "~/infrastructure/context/serviceContext";
import { taskReference } from "~/modules/project-tasks/domain/work-actors";
import { buildWorkRunTools } from "~/modules/project-tasks/domain/work-tools";
import { ProjectTaskRepository } from "~/modules/project-tasks/infrastructure/ProjectTaskRepository";
import { TaskService } from "~/modules/queue/application/TaskService";
import { TaskRepository } from "~/modules/queue/infrastructure/TaskRepository";
import { TeammateRepository } from "~/modules/teammates/infrastructure/TeammateRepository";
import {
  WorkspaceTeammateRepository,
  type WorkspaceTeammateRecord,
} from "~/modules/teammates/infrastructure/WorkspaceTeammateRepository";
import { UserRepository } from "~/modules/user/infrastructure/UserRepository";
import { WorkspaceRepository } from "~/modules/workspaces/infrastructure/WorkspaceRepository";
import type { IEnv } from "~/types";

import { ensureActiveTeammateContext } from "./contexts";
import { assertTeammateEmploymentAvailable, resolveManager } from "./organisation";
import { enqueueTeammateRun } from "./run-admission";
import { ensureWorkspaceWakeConversation, resolveProjectTeammateScope } from "./work-scope";

const HEARTBEAT_PROJECT_LIMIT = 5;
const WAKE_REASON_TEXT: Record<WorkWakeReason, string> = {
  assigned: "a task was assigned to you",
  mentioned: "someone mentioned you on a task",
  review: "a task is waiting for your review",
  heartbeat: "your scheduled heartbeat came round",
  standup: "standup has started and your answers are due",
  standup_summary: "everyone has answered standup and it needs a summary",
  escalation: "one of your reports escalated something to you",
  setup: "the workspace needs its setup plan",
  blocker_cleared: "something you were waiting on has finished",
  report_blocked: "one of your reports is stuck, and you handle it before a person is asked",
};

const UNTHROTTLED_WAKE_REASONS: ReadonlySet<WorkWakeReason> = new Set(["report_blocked"]);

function minutesAgo(now: Date, minutes: number): number {
  return now.getTime() - minutes * MINUTE_MS;
}

function formatTaskLine(task: ProjectTask): string {
  const key = taskReference(task);
  const blocked = task.blockedDetail ? ` — ${task.blockedDetail}` : "";

  return `- ${key} [${task.status}${task.priority !== "none" ? `, ${task.priority}` : ""}] ${task.objective}${blocked}`;
}

export async function enqueueTeammateWake(
  context: ServiceContext,
  params: {
    workspaceId: string;
    teammateId: string;
    projectId: string;
    reason: WorkWakeReason;
    taskId?: string | null;
    detail?: string | null;
  },
): Promise<boolean> {
  const repository = context.repositories.get(WorkspaceTeammateRepository);
  const employment = await repository.get(params.workspaceId, params.teammateId);

  if (!employment || employment.status !== "active") {
    return false;
  }

  const now = new Date();
  const recent = employment.lastWake;

  if (
    recent &&
    !UNTHROTTLED_WAKE_REASONS.has(params.reason) &&
    recent.reason === params.reason &&
    recent.taskId === (params.taskId ?? null) &&
    parseStoredTimestamp(recent.at) > minutesAgo(now, WORK_WAKE_QUIET_MINUTES)
  ) {
    return false;
  }

  const taskData: WorkTeammateWakeTaskData = {
    workspaceId: params.workspaceId,
    teammateId: params.teammateId,
    projectId: params.projectId,
    reason: params.reason,
    taskId: params.taskId ?? null,
    detail: params.detail ?? null,
  };

  await new TaskService(context.env, context.repositories.get(TaskRepository)).enqueueTask({
    id: generateId(),
    task_type: WORK_TEAMMATE_WAKE_TASK_TYPE,
    user_id: employment.responsibleUserId,
    project_id: params.projectId,
    priority: 4,
    task_data: taskData,
  });
  await repository.update(params.workspaceId, params.teammateId, {
    lastWake: {
      at: now.toISOString(),
      projectId: params.projectId,
      reason: params.reason,
      taskId: params.taskId ?? null,
      settled: false,
    },
    ...(params.reason === "heartbeat" ? { lastHeartbeatAt: now.toISOString() } : {}),
  });

  return true;
}

async function describeManager(
  context: ServiceContext,
  workspaceId: string,
  teammateId: string,
): Promise<string> {
  const manager = await resolveManager(context, workspaceId, teammateId);

  if (manager.type === "teammate") {
    const teammate = await context.repositories.get(TeammateRepository).getTeammateById(manager.id);

    return teammate?.name ?? "your manager";
  }

  const person = await context.repositories.get(UserRepository).getUserById(manager.userId);

  return person?.name ?? "the person responsible for you";
}

async function buildWakeBrief(
  context: ServiceContext,
  params: {
    data: WorkTeammateWakeTaskData;
    employment: WorkspaceTeammateRecord;
    teammateName: string;
    projectName: string;
    isLead: boolean;
  },
): Promise<string> {
  const { data, employment } = params;
  const [tasks, team] = await Promise.all([
    context.repositories.get(ProjectTaskRepository).listProjectTasks(data.projectId, {}),
    context.repositories.get(WorkspaceTeammateRepository).listForWorkspace(data.workspaceId),
  ]);
  const reports = new Set(
    team
      .filter((member) => member.reportsToTeammateId === employment.teammateId)
      .map((member) => member.teammateId),
  );
  const open = tasks.filter((task) => !isTerminalProjectTaskStatus(task.status));
  const own = open.filter(
    (task) => task.owner?.type === "teammate" && task.owner.id === employment.teammateId,
  );
  const reviewing = open.filter(
    (task) =>
      task.status === "review" &&
      task.reviewer?.type === "teammate" &&
      task.reviewer.id === employment.teammateId,
  );
  const teamWork = open.filter(
    (task) =>
      task.owner?.type === "teammate" &&
      reports.has(task.owner.id) &&
      (task.status === "blocked" || task.status === "review"),
  );
  const cases = params.isLead
    ? open.filter((task) => task.kind === "case" && !task.owner && task.status === "backlog")
    : [];

  return renderPrompt("apps/work/wake-brief", {
    name: params.teammateName,
    title: employment.title,
    project: params.projectName,
    reason: WAKE_REASON_TEXT[data.reason],
    detail: [data.taskId ? `Focus on task ${data.taskId}.` : "", data.detail ?? ""]
      .filter(Boolean)
      .join(" "),
    manager: await describeManager(context, data.workspaceId, employment.teammateId),
    ownTasks: own.length ? own.map(formatTaskLine).join("\n") : "- None right now.",
    reviewTasks: reviewing.map(formatTaskLine).join("\n"),
    teamTasks: teamWork.map(formatTaskLine).join("\n"),
    cases: cases.map(formatTaskLine).join("\n"),
  });
}

export async function runTeammateWake(
  env: IEnv,
  userId: number,
  data: WorkTeammateWakeTaskData,
): Promise<void> {
  const user = await createServiceContext({ env })
    .repositories.get(UserRepository)
    .getUserById(userId);

  if (!user) {
    return;
  }

  const context = createServiceContext({ env, user });
  const employment = await context.repositories
    .get(WorkspaceTeammateRepository)
    .get(data.workspaceId, data.teammateId);

  if (!employment || employment.status !== "active") {
    return;
  }

  await assertTeammateEmploymentAvailable(context, data.workspaceId, data.teammateId);

  const [teammate, project, workspace] = await Promise.all([
    context.repositories.get(TeammateRepository).getTeammateById(data.teammateId),
    context.repositories.get(WorkspaceRepository).getProject(data.projectId),
    context.repositories.get(WorkspaceRepository).getWorkspace(data.workspaceId),
  ]);

  if (!teammate || !project || project.workspace_id !== data.workspaceId) {
    return;
  }

  const teammateContext = await ensureActiveTeammateContext(
    context,
    data.teammateId,
    await resolveProjectTeammateScope(context, data.teammateId, data.projectId),
  );
  const brief = await buildWakeBrief(context, {
    data,
    employment,
    teammateName: teammate.name,
    projectName: project.name,
    isLead: workspace?.lead_teammate_id === data.teammateId,
  });
  const enabledTools = buildWorkRunTools(readToolIds(teammate.enabled_tools) ?? []);

  const conversationId = await ensureWorkspaceWakeConversation(context, teammateContext, project);

  await enqueueTeammateRun({
    env,
    context,
    body: {
      conversationId,
      messages: [{ role: "user", content: brief }],
      stream: false,
      store: true,
      settings: {
        mode: "agent",
        enabled_tools: enabledTools,
        tool_choice: "auto",
        metadata: { project_id: data.projectId },
      },
    },
    teammateId: data.teammateId,
    user,
    anonymousUser: undefined,
    invocation: { source: "conversation", conversationId },
    authority: { trigger: "schedule" },
  });
}

async function listHeartbeatProjects(
  context: ServiceContext,
  employment: WorkspaceTeammateRecord,
  isLead: boolean,
): Promise<string[]> {
  const tasks = await context.repositories
    .get(ProjectTaskRepository)
    .listWorkspaceTasks(
      [employment.workspaceId],
      isLead ? {} : { ownerTeammateId: employment.teammateId },
    );
  const fromTasks = tasks.map((task) => task.projectId);

  return [...new Set([...employment.projectIds, ...fromTasks])].slice(0, HEARTBEAT_PROJECT_LIMIT);
}

export async function scheduleWorkHeartbeats(env: IEnv, now = new Date()): Promise<number> {
  const context = createServiceContext({ env });
  const employments = await context.repositories.get(WorkspaceTeammateRepository).listAwake();
  const leads = new Map<string, string | null>();
  let woken = 0;

  for (const employment of employments) {
    if (
      employment.status !== "active" ||
      !employment.heartbeatMinutes ||
      parseStoredTimestamp(employment.lastHeartbeatAt) >
        minutesAgo(now, employment.heartbeatMinutes)
    ) {
      continue;
    }

    if (!leads.has(employment.workspaceId)) {
      const workspace = await context.repositories
        .get(WorkspaceRepository)
        .getWorkspace(employment.workspaceId);

      leads.set(employment.workspaceId, workspace?.lead_teammate_id ?? null);
    }

    const isLead = leads.get(employment.workspaceId) === employment.teammateId;
    const projectIds = await listHeartbeatProjects(context, employment, isLead);

    await context.repositories
      .get(WorkspaceTeammateRepository)
      .update(employment.workspaceId, employment.teammateId, {
        lastHeartbeatAt: now.toISOString(),
      });

    for (const projectId of projectIds) {
      const queued = await enqueueTeammateWake(context, {
        workspaceId: employment.workspaceId,
        teammateId: employment.teammateId,
        projectId,
        reason: "heartbeat",
      });

      woken += queued ? 1 : 0;
    }
  }

  return woken;
}

export async function watchStalledWakes(env: IEnv, now = new Date()): Promise<number> {
  const context = createServiceContext({ env });
  const repository = context.repositories.get(WorkspaceTeammateRepository);
  const employments = await repository.listAwake();
  let escalated = 0;

  for (const employment of employments) {
    const wake = employment.lastWake;

    if (
      !wake ||
      wake.settled ||
      parseStoredTimestamp(wake.at) > minutesAgo(now, WORK_WATCHDOG_GRACE_MINUTES)
    ) {
      continue;
    }

    const tasks = await context.repositories
      .get(ProjectTaskRepository)
      .listWorkspaceTasks([employment.workspaceId], {
        ownerTeammateId: employment.teammateId,
        includeDone: true,
      });
    const focus = wake.taskId
      ? await context.repositories.get(ProjectTaskRepository).getTaskById(wake.taskId)
      : null;
    const touched = [...tasks, ...(focus ? [focus] : [])].some(
      (task) => parseStoredTimestamp(task.updatedAt) > parseStoredTimestamp(wake.at),
    );

    await repository.update(employment.workspaceId, employment.teammateId, {
      lastWake: { ...wake, settled: true },
    });

    if (touched || !focus || isTerminalProjectTaskStatus(focus.status)) {
      continue;
    }

    const responsible = await context.repositories
      .get(UserRepository)
      .getUserById(employment.responsibleUserId);

    if (!responsible) {
      continue;
    }

    const actingContext = createServiceContext({ env, user: responsible });
    const manager = await resolveManager(
      actingContext,
      employment.workspaceId,
      employment.teammateId,
    );
    const teammate = await context.repositories
      .get(TeammateRepository)
      .getTeammateById(employment.teammateId);
    const reason = `${teammate?.name ?? "A teammate"} woke for ${WAKE_REASON_TEXT[wake.reason]} and stopped without an update, a status change or a named blocker.`;

    await context.repositories.get(ProjectTaskRepository).updateTask(focus.id, {
      details: {
        ...focus.details,
        escalation: {
          to: manager,
          reason,
          by: { type: "teammate", id: employment.teammateId },
          at: now.toISOString(),
        },
      },
    });

    if (manager.type === "teammate") {
      await enqueueTeammateWake(actingContext, {
        workspaceId: employment.workspaceId,
        teammateId: manager.id,
        projectId: focus.projectId,
        reason: "escalation",
        taskId: focus.id,
        detail: reason,
      });
    }

    escalated += 1;
  }

  return escalated;
}
