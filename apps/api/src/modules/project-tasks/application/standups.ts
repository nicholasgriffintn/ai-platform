import {
  DEFAULT_STANDUP_SETTINGS,
  isTerminalProjectTaskStatus,
  projectTaskStatusLabels,
  standupSettingsSchema,
  type AnswerStandupInput,
  type ProjectTask,
  type ProjectTaskStandup,
  type StandupParticipant,
  type StandupSettings,
  type WorkActor,
} from "@ngriffin_uk/polychat-schemas";
import {
  parseStoredTimestamp,
  readZonedClock,
  safeParseJson,
} from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { createServiceContext, type ServiceContext } from "~/infrastructure/context/serviceContext";
import { CHANNEL_TOP_LEVEL_THREAD } from "~/modules/channels/application/ports/channel-adapter";
import { getChannelAdapter } from "~/modules/channels/infrastructure/adapters";
import { ChannelBindingRepository } from "~/modules/channels/infrastructure/ChannelBindingRepository";
import { deliverOutboundOperation } from "~/modules/delivery/application/outbound";
import { ProjectTaskRepository } from "~/modules/project-tasks/infrastructure/ProjectTaskRepository";
import { enqueueTeammateWake } from "~/modules/teammates/application/wakes";
import { TeammateRepository } from "~/modules/teammates/infrastructure/TeammateRepository";
import { WorkspaceTeammateRepository } from "~/modules/teammates/infrastructure/WorkspaceTeammateRepository";
import { UserRepository } from "~/modules/user/infrastructure/UserRepository";
import { requireProjectAccess } from "~/modules/workspaces/application/access";
import {
  WorkspaceRepository,
  type ProjectRow,
} from "~/modules/workspaces/infrastructure/WorkspaceRepository";
import type { IEnv } from "~/types";

import { createProjectTask } from "./index";
import { postToTaskThread } from "./thread";
import type { WorkCaller } from "./work";

const MINUTE_MS = 60_000;
const DRAFT_LOOKBACK_MS = 24 * 60 * MINUTE_MS;

function readSettings(project: Pick<ProjectRow, "standup">): StandupSettings {
  const stored = project.standup ? safeParseJson(project.standup) : null;
  const parsed = standupSettingsSchema.safeParse(stored);

  return parsed.success ? parsed.data : DEFAULT_STANDUP_SETTINGS;
}

function sameActor(left: WorkActor, right: WorkActor): boolean {
  return left.type === "teammate"
    ? right.type === "teammate" && right.id === left.id
    : right.type === "person" && right.userId === left.userId;
}

function formatStandupTitle(date: Date, timeZone: string): string {
  return `Standup · ${new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date)}`;
}

export async function getStandupSettings(
  context: ServiceContext,
  projectId: string,
): Promise<StandupSettings> {
  const { project } = await requireProjectAccess(context, projectId);

  return readSettings(project);
}

export async function setStandupSettings(
  context: ServiceContext,
  projectId: string,
  settings: StandupSettings,
): Promise<StandupSettings> {
  await requireProjectAccess(context, projectId, ["owner", "admin"]);
  const parsed = standupSettingsSchema.parse(settings);

  if (parsed.shareBindingId) {
    const binding = await context.repositories
      .get(ChannelBindingRepository)
      .getById(parsed.shareBindingId);

    if (!binding || binding.scope_type !== "project" || binding.scope_id !== projectId) {
      throw new AssistantError(
        "Share standups only to a channel connected to this project",
        ErrorType.PARAMS_ERROR,
        400,
      );
    }
  }

  readZonedClock(new Date(), parsed.timeZone);
  await context.repositories
    .get(WorkspaceRepository)
    .updateProject(projectId, { standup: JSON.stringify(parsed) });

  return parsed;
}

async function listParticipants(
  context: ServiceContext,
  project: ProjectRow,
  settings: StandupSettings,
): Promise<StandupParticipant[]> {
  const people =
    settings.participants === "teammates"
      ? []
      : (await context.repositories.get(WorkspaceRepository).listMembers(project.workspace_id)).map(
          (member): StandupParticipant => ({
            actor: { type: "person", userId: member.user_id },
            name: member.name ?? member.email,
          }),
        );

  if (settings.participants === "people") {
    return people;
  }

  const [team, tasks] = await Promise.all([
    context.repositories.get(WorkspaceTeammateRepository).listForWorkspace(project.workspace_id),
    context.repositories.get(ProjectTaskRepository).listProjectTasks(project.id, {}),
  ]);
  const working = new Set(
    tasks.flatMap((task) => (task.owner?.type === "teammate" ? [task.owner.id] : [])),
  );
  const members = team.filter(
    (member) =>
      member.status === "active" &&
      (member.projectIds.includes(project.id) || working.has(member.teammateId)),
  );
  const teammates = await context.repositories
    .get(TeammateRepository)
    .getTeammatesByIds(members.map((member) => member.teammateId));

  return [
    ...people,
    ...teammates.map((teammate): StandupParticipant => ({
      actor: { type: "teammate", id: teammate.id },
      name: teammate.name,
    })),
  ];
}

function isStandupDue(project: ProjectRow, settings: StandupSettings, now: Date): boolean {
  const clock = readZonedClock(now, settings.timeZone);
  const lastRun = project.standup_last_run_at
    ? readZonedClock(new Date(project.standup_last_run_at), settings.timeZone).date
    : null;

  return (
    settings.days.includes(clock.weekday) && clock.time >= settings.time && lastRun !== clock.date
  );
}

async function openStandup(env: IEnv, project: ProjectRow, settings: StandupSettings, now: Date) {
  const owner = await createServiceContext({ env })
    .repositories.get(UserRepository)
    .getUserById(project.created_by);

  if (!owner) {
    return;
  }

  const context = createServiceContext({ env, user: owner });
  const workspace = await context.repositories
    .get(WorkspaceRepository)
    .getWorkspace(project.workspace_id);
  const participants = await listParticipants(context, project, settings);
  const standup: ProjectTaskStandup = {
    date: readZonedClock(now, settings.timeZone).date,
    questions: settings.questions,
    participants,
    answers: [],
    summary: null,
    summarisedAt: null,
    closesAt: new Date(now.getTime() + settings.windowMinutes * MINUTE_MS).toISOString(),
  };

  await context.repositories
    .get(WorkspaceRepository)
    .updateProject(project.id, { standup_last_run_at: now.toISOString() });

  const { task } = await createProjectTask(
    context,
    project.id,
    {
      objective: formatStandupTitle(now, settings.timeZone),
      kind: "standup",
      ...(workspace?.lead_teammate_id
        ? { owner: { type: "teammate", id: workspace.lead_teammate_id } }
        : {}),
    },
    { details: { standup } },
  );

  for (const participant of participants) {
    if (participant.actor.type === "teammate") {
      await enqueueTeammateWake(context, {
        workspaceId: project.workspace_id,
        teammateId: participant.actor.id,
        projectId: project.id,
        reason: "standup",
        taskId: task.id,
        detail: `Answer standup ${task.key ?? task.id} with answer_standup, using only your own task activity since the last standup: ${settings.questions.join(" / ")}`,
      });
    }
  }
}

function summariseFromAnswers(standup: ProjectTaskStandup): string {
  const lines = standup.answers.map(
    (answer) => `${answer.name}: ${answer.answers.map((entry) => entry.answer || "—").join(" · ")}`,
  );
  const missing = standup.participants
    .filter(
      (participant) =>
        !standup.answers.some((answer) => sameActor(answer.actor, participant.actor)),
    )
    .map((participant) => participant.name);

  return [...lines, ...(missing.length ? [`No answer from ${missing.join(", ")}.`] : [])].join(
    "\n",
  );
}

async function requestSummary(context: ServiceContext, task: ProjectTask): Promise<void> {
  const standup = task.details.standup;

  if (!standup || standup.summary) {
    return;
  }

  if (task.owner?.type === "teammate") {
    const queued = await enqueueTeammateWake(context, {
      workspaceId: task.workspaceId,
      teammateId: task.owner.id,
      projectId: task.projectId,
      reason: "standup_summary",
      taskId: task.id,
      detail: `Read the answers on ${task.key ?? task.id}, then call summarise_standup. Propose tasks for untracked work, update blockers that name a task, raise cases for problems with no task behind them, and never mark anything done.`,
    });

    if (queued) {
      return;
    }
  }

  await completeStandup(context, task, summariseFromAnswers(standup), null);
}

async function completeStandup(
  context: ServiceContext,
  task: ProjectTask,
  summary: string,
  caller: WorkCaller | null,
): Promise<ProjectTask> {
  const standup = task.details.standup;

  if (!standup) {
    throw new AssistantError("This is not a standup", ErrorType.PARAMS_ERROR, 400);
  }

  const summarisedAt = new Date().toISOString();
  const updated = await context.repositories.get(ProjectTaskRepository).updateTask(task.id, {
    status: "done",
    completedAt: summarisedAt,
    details: { ...task.details, standup: { ...standup, summary, summarisedAt } },
  });

  if (!updated) {
    throw new AssistantError("Task not found", ErrorType.NOT_FOUND, 404);
  }

  await postToTaskThread(context, updated, {
    kind: "update",
    author: caller?.author ?? { kind: "system", name: "Standup", userId: null, teammateId: null },
    body: summary,
  });
  await shareStandupSummary(context, updated, summary);

  return updated;
}

async function shareStandupSummary(
  context: ServiceContext,
  task: ProjectTask,
  summary: string,
): Promise<void> {
  const project = await context.repositories.get(WorkspaceRepository).getProject(task.projectId);
  const settings = project ? readSettings(project) : null;

  if (!settings?.shareBindingId) {
    return;
  }

  const binding = await context.repositories
    .get(ChannelBindingRepository)
    .getById(settings.shareBindingId);
  const adapter = binding?.enabled ? getChannelAdapter(binding.channel) : null;

  if (!binding || !adapter?.isReplyConfigured(context.env)) {
    return;
  }

  const body = `${task.objective}\n\n${summary}`;

  await deliverOutboundOperation({
    context,
    deliveryId: `standup_share_${task.id}`,
    userId: context.requireUser().id,
    kind: "channel_reply",
    scopeId: binding.id,
    operationId: task.id,
    payload: { bindingId: binding.id, body },
    send: () =>
      adapter.sendReply(
        { externalId: binding.external_id, body, threadId: CHANNEL_TOP_LEVEL_THREAD },
        context.env,
      ),
  });
}

export async function runDueStandups(env: IEnv, now = new Date()): Promise<void> {
  const repository = new WorkspaceRepository(env);
  const projects = await repository.listProjectsWithStandup();

  for (const project of projects) {
    const settings = readSettings(project);

    if (settings.enabled && isStandupDue(project, settings, now)) {
      await openStandup(env, project, settings, now);
    }
  }

  const context = createServiceContext({ env });

  for (const project of projects) {
    const open = await context.repositories
      .get(ProjectTaskRepository)
      .listProjectTasks(project.id, { kind: "standup" });

    for (const task of open) {
      const standup = task.details.standup;

      if (
        standup &&
        !standup.summary &&
        !isTerminalProjectTaskStatus(task.status) &&
        Date.parse(standup.closesAt) <= now.getTime()
      ) {
        const owner = await context.repositories
          .get(UserRepository)
          .getUserById(project.created_by);

        if (owner) {
          await requestSummary(createServiceContext({ env, user: owner }), task);
        }
      }
    }
  }
}

async function requireStandupTask(
  context: ServiceContext,
  projectId: string,
  taskId: string,
): Promise<ProjectTask & { details: { standup: ProjectTaskStandup } }> {
  await requireProjectAccess(context, projectId);
  const task = await context.repositories
    .get(ProjectTaskRepository)
    .getTaskByReference(projectId, taskId);
  const standup = task?.details.standup;

  if (!task || task.kind !== "standup" || !standup) {
    throw new AssistantError("Standup not found", ErrorType.NOT_FOUND, 404);
  }

  return { ...task, details: { ...task.details, standup } };
}

export async function answerStandup(
  context: ServiceContext,
  projectId: string,
  taskId: string,
  input: AnswerStandupInput,
  caller: WorkCaller,
): Promise<ProjectTask> {
  const task = await requireStandupTask(context, projectId, taskId);
  const standup = task.details.standup;

  if (standup.summary || isTerminalProjectTaskStatus(task.status)) {
    throw new AssistantError("This standup has closed", ErrorType.CONFLICT_ERROR, 409);
  }

  if (!standup.participants.some((participant) => sameActor(participant.actor, caller.actor))) {
    throw new AssistantError("You are not in this standup", ErrorType.FORBIDDEN, 403);
  }

  const answers = [
    ...standup.answers.filter((answer) => !sameActor(answer.actor, caller.actor)),
    {
      actor: caller.actor,
      name: caller.author.name,
      answers: input.answers,
      answeredAt: new Date().toISOString(),
    },
  ];
  const updated = await context.repositories.get(ProjectTaskRepository).updateTask(task.id, {
    details: { ...task.details, standup: { ...standup, answers } },
  });

  if (!updated) {
    throw new AssistantError("Task not found", ErrorType.NOT_FOUND, 404);
  }

  await postToTaskThread(context, updated, {
    kind: caller.actor.type === "person" ? "comment" : "update",
    author: caller.author,
    body: input.answers.map((entry) => `${entry.question}\n${entry.answer || "—"}`).join("\n\n"),
  });

  if (answers.length >= standup.participants.length) {
    await requestSummary(context, updated);
  }

  return (await context.repositories.get(ProjectTaskRepository).getTaskById(task.id)) ?? updated;
}

export async function summariseStandup(
  context: ServiceContext,
  projectId: string,
  taskId: string,
  summary: string,
  caller: WorkCaller,
): Promise<ProjectTask> {
  const task = await requireStandupTask(context, projectId, taskId);

  if (task.details.standup.summary) {
    throw new AssistantError("This standup already has a summary", ErrorType.CONFLICT_ERROR, 409);
  }

  return completeStandup(context, task, summary, caller);
}

export async function getStandupDraft(
  context: ServiceContext,
  projectId: string,
  taskId: string,
): Promise<AnswerStandupInput> {
  const user = context.requireUser();
  const task = await requireStandupTask(context, projectId, taskId);
  const since = parseStoredTimestamp(task.createdAt) - DRAFT_LOOKBACK_MS;
  const tasks = await context.repositories
    .get(ProjectTaskRepository)
    .listWorkspaceTasks([task.workspaceId], {
      ownerOrResponsibleUserId: user.id,
      includeDone: true,
    });
  const recent = tasks.filter((candidate) => {
    return (
      candidate.kind === "task" &&
      parseStoredTimestamp(candidate.updatedAt ?? candidate.createdAt) >= since
    );
  });
  const moved = recent
    .filter((candidate) => candidate.status === "done" || candidate.status === "review")
    .map(
      (candidate) =>
        `${candidate.key ?? candidate.id} ${candidate.objective} (${projectTaskStatusLabels[candidate.status]})`,
    );
  const next = recent
    .filter(
      (candidate) =>
        !isTerminalProjectTaskStatus(candidate.status) && candidate.status !== "review",
    )
    .map((candidate) => `${candidate.key ?? candidate.id} ${candidate.objective}`);
  const blocked = recent
    .filter((candidate) => candidate.status === "blocked")
    .map(
      (candidate) => `${candidate.key ?? candidate.id}: ${candidate.blockedDetail ?? "blocked"}`,
    );
  const drafts = [moved.join("; "), next.join("; "), blocked.join("; ")];

  return {
    answers: task.details.standup.questions.map((question, index) => ({
      question,
      answer: drafts[index] ?? "",
    })),
  };
}
