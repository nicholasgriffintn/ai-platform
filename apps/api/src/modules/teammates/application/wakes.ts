import { renderPrompt } from "@ngriffin_uk/polychat-ai-prompts";
import {
  creditsFromCreditMicros,
  readToolIds,
  WORK_TEAMMATE_WAKE_TASK_TYPE,
  WORK_WAKE_QUIET_MINUTES,
  WORK_WATCHDOG_GRACE_MINUTES,
  type WorkTeammateWakeTaskData,
  type WorkWakeRecord,
  type WorkWakeReason,
} from "@ngriffin_uk/polychat-schemas";
import {
  formatCredits,
  generateId,
  MINUTE_MS,
  parseStoredTimestamp,
} from "@ngriffin_uk/polychat-utility-core";

import { createServiceContext, type ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  describeTeammateWorkload,
  listTeammateWorkProjectIds,
} from "~/modules/project-tasks/application/teammate-work";
import { buildWorkRunTools } from "~/modules/project-tasks/domain/work-tools";
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

import { reviewWorkBudgets, type BudgetAlert } from "./budgets";
import { ensureActiveTeammateContext } from "./contexts";
import { resolveManager } from "./organisation";
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
  report_budget:
    "one of your reports is running out of its monthly budget, and you decide whether it gets more",
};

const UNTHROTTLED_WAKE_REASONS: ReadonlySet<WorkWakeReason> = new Set(["report_blocked"]);

function minutesAgo(now: Date, minutes: number): number {
  return now.getTime() - minutes * MINUTE_MS;
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
  const team = await context.repositories
    .get(WorkspaceTeammateRepository)
    .listForWorkspace(data.workspaceId);
  const [workload, manager] = await Promise.all([
    describeTeammateWorkload(context, {
      projectId: data.projectId,
      teammateId: employment.teammateId,
      reportIds: team
        .filter((member) => member.reportsToTeammateId === employment.teammateId)
        .map((member) => member.teammateId),
      isLead: params.isLead,
    }),
    describeManager(context, data.workspaceId, employment.teammateId),
  ]);

  return renderPrompt("apps/work/wake-brief", {
    name: params.teammateName,
    title: employment.title,
    project: params.projectName,
    reason: WAKE_REASON_TEXT[data.reason],
    detail: [data.taskId ? `Focus on task ${data.taskId}.` : "", data.detail ?? ""]
      .filter(Boolean)
      .join(" "),
    manager,
    ownTasks: workload.ownTasks.length ? workload.ownTasks.join("\n") : "- None right now.",
    reviewTasks: workload.reviewTasks.join("\n"),
    teamTasks: workload.teamTasks.join("\n"),
    cases: workload.cases.join("\n"),
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
  const fromTasks = await listTeammateWorkProjectIds(context, {
    workspaceId: employment.workspaceId,
    teammateId: isLead ? null : employment.teammateId,
    limit: HEARTBEAT_PROJECT_LIMIT,
  });

  return [...new Set([...employment.projectIds, ...fromTasks])].slice(0, HEARTBEAT_PROJECT_LIMIT);
}

async function scheduleWorkHeartbeats(
  context: ServiceContext,
  employments: readonly WorkspaceTeammateRecord[],
  now: Date,
): Promise<number> {
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

export function describeWakeReason(reason: WorkWakeReason): string {
  return WAKE_REASON_TEXT[reason];
}

export async function listStaleWakes(
  context: ServiceContext,
  now: Date,
): Promise<{ employment: WorkspaceTeammateRecord; wake: WorkWakeRecord }[]> {
  const employments = await context.repositories.get(WorkspaceTeammateRepository).listAwake();

  return employments.flatMap((employment) => {
    const wake = employment.lastWake;

    return wake &&
      !wake.settled &&
      parseStoredTimestamp(wake.at) <= minutesAgo(now, WORK_WATCHDOG_GRACE_MINUTES)
      ? [{ employment, wake }]
      : [];
  });
}

export async function settleWake(
  context: ServiceContext,
  employment: WorkspaceTeammateRecord,
  wake: WorkWakeRecord,
): Promise<void> {
  await context.repositories
    .get(WorkspaceTeammateRepository)
    .update(employment.workspaceId, employment.teammateId, {
      lastWake: { ...wake, settled: true },
    });
}

async function wakeManagersForBudgets(
  context: ServiceContext,
  alerts: readonly BudgetAlert[],
): Promise<void> {
  const teammates = await context.repositories
    .get(TeammateRepository)
    .getTeammatesByIds([...new Set(alerts.map((alert) => alert.teammateId))]);
  const names = new Map(teammates.map((teammate) => [teammate.id, teammate.name]));

  for (const alert of alerts) {
    const name = names.get(alert.teammateId) ?? "A report";
    const usage = `${formatCredits(creditsFromCreditMicros(alert.usedMicros))} of its ${formatCredits(creditsFromCreditMicros(alert.capMicros))} credits`;

    await enqueueTeammateWake(context, {
      workspaceId: alert.workspaceId,
      teammateId: alert.managerId,
      projectId: alert.projectId,
      reason: "report_budget",
      detail:
        alert.kind === "paused"
          ? `${name} has used ${usage} this month and is paused. If its work is worth more, give it more with set_budget; otherwise leave it paused until next month.`
          : `${name} has used ${usage} this month. Decide whether to give it more with set_budget, or let it pause at its cap.`,
    });
  }
}

export async function runWorkRhythm(env: IEnv, now = new Date()): Promise<void> {
  const context = createServiceContext({ env });
  const { employments, alerts } = await reviewWorkBudgets(
    context,
    await context.repositories.get(WorkspaceTeammateRepository).listAwake(),
  );

  await wakeManagersForBudgets(context, alerts);
  await scheduleWorkHeartbeats(context, employments, now);
}
