import {
  isTerminalProjectTaskStatus,
  WORK_MAX_AGENT_REVIEW_ROUNDS,
  type CaseSource,
  type ProjectTaskCase,
  type ProjectTask,
  type ProjectTaskLinkKind,
  type ProjectTaskThreadPost,
  type RaiseCaseInput,
  type UserQuestionAnswer,
  type WorkActor,
  type WorkPostAuthor,
} from "@ngriffin_uk/polychat-schemas";
import { extractMentions } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { AuditRepository } from "~/modules/audit/infrastructure/AuditRepository";
import { sameWorkActor, taskReference } from "~/modules/project-tasks/domain/work-actors";
import { ProjectTaskRepository } from "~/modules/project-tasks/infrastructure/ProjectTaskRepository";
import { listActiveWorkspaceTeammates } from "~/modules/teammates/application/directory";
import { managesTeammate, resolveManager } from "~/modules/teammates/application/organisation";
import { enqueueTeammateWake } from "~/modules/teammates/application/wakes";
import { TeammateRepository } from "~/modules/teammates/infrastructure/TeammateRepository";
import { UserRepository } from "~/modules/user/infrastructure/UserRepository";
import { requireProjectAccess } from "~/modules/workspaces/application/access";

import { reconcileTaskNotifications } from "./attention";
import {
  acceptProjectTask,
  createProjectTask,
  respondToProjectTaskQuestions,
  startProjectTask,
  updateProjectTask,
} from "./index";
import { getPendingProjectTaskQuestions } from "./questions";
import { postToTaskThread } from "./thread";

export interface WorkCaller {
  actor: WorkActor;
  author: WorkPostAuthor;
}

export function personCaller(context: ServiceContext): WorkCaller {
  const user = context.requireUser();

  return {
    actor: { type: "person", userId: user.id },
    author: { kind: "person", name: user.name ?? "Someone", userId: user.id, teammateId: null },
  };
}

export async function teammateCaller(
  context: ServiceContext,
  teammateId: string,
): Promise<WorkCaller> {
  const teammate = await context.repositories.get(TeammateRepository).getTeammateById(teammateId);

  return {
    actor: { type: "teammate", id: teammateId },
    author: {
      kind: "teammate",
      name: teammate?.name ?? "Teammate",
      userId: null,
      teammateId,
    },
  };
}

export async function requireTaskInProject(
  context: ServiceContext,
  projectId: string,
  taskId: string,
): Promise<ProjectTask> {
  await requireProjectAccess(context, projectId);
  const task = await context.repositories
    .get(ProjectTaskRepository)
    .getTaskByReference(projectId, taskId);

  if (!task) {
    throw new AssistantError("Task not found", ErrorType.NOT_FOUND, 404);
  }

  return task;
}

async function describeActor(context: ServiceContext, actor: WorkActor): Promise<string> {
  if (actor.type === "teammate") {
    const teammate = await context.repositories.get(TeammateRepository).getTeammateById(actor.id);

    return teammate?.name ?? "a teammate";
  }

  const person = await context.repositories.get(UserRepository).getUserById(actor.userId);

  return person?.name ?? "a person";
}

export async function postEvent(
  context: ServiceContext,
  task: ProjectTask,
  caller: WorkCaller,
  body: string,
): Promise<void> {
  await postToTaskThread(context, task, { kind: "event", author: caller.author, body });
  await context.repositories.get(ProjectTaskRepository).touchTask(task.id);
}

export async function wakeTeammateOnTask(
  context: ServiceContext,
  task: ProjectTask,
  teammateId: string,
  reason: "assigned" | "mentioned" | "review" | "escalation",
  detail: string | null,
): Promise<void> {
  const ownsTask = task.owner?.type === "teammate" && task.owner.id === teammateId;
  const canRunTask =
    ownsTask &&
    task.kind === "task" &&
    (task.status === "backlog" ||
      (task.status === "blocked" &&
        task.blockedReason !== "awaiting_approval" &&
        task.blockedReason !== "awaiting_input"));

  if (canRunTask) {
    try {
      await startProjectTask(context, task.projectId, task.id);

      return;
    } catch (error) {
      if (!(error instanceof AssistantError) || error.statusCode !== 409) {
        throw error;
      }
    }
  }

  await enqueueTeammateWake(context, {
    workspaceId: task.workspaceId,
    teammateId,
    projectId: task.projectId,
    reason,
    taskId: task.id,
    detail,
  });
}

export async function commentOnTask(
  context: ServiceContext,
  projectId: string,
  taskId: string,
  body: string,
  caller: WorkCaller = personCaller(context),
): Promise<ProjectTaskThreadPost> {
  const task = await requireTaskInProject(context, projectId, taskId);
  const post = await postToTaskThread(context, task, {
    kind: caller.actor.type === "person" ? "comment" : "update",
    author: caller.author,
    body,
  });

  await context.repositories.get(ProjectTaskRepository).touchTask(task.id);

  const mentions = extractMentions(body);

  if (mentions.length === 0) {
    return post;
  }

  const mentioned = (await listActiveWorkspaceTeammates(context, task.workspaceId)).filter(
    (teammate) => {
      const name = teammate.name.toLowerCase();

      return mentions.some((mention) => name === mention || name.split(/\s+/)[0] === mention);
    },
  );

  for (const teammate of mentioned) {
    if (caller.actor.type === "teammate" && caller.actor.id === teammate.teammateId) {
      continue;
    }

    await wakeTeammateOnTask(context, task, teammate.teammateId, "mentioned", body.slice(0, 500));
  }

  return post;
}

export async function assignTask(
  context: ServiceContext,
  projectId: string,
  taskId: string,
  owner: WorkActor,
  caller: WorkCaller,
): Promise<ProjectTask> {
  const task = await requireTaskInProject(context, projectId, taskId);
  const { task: updated } = await updateProjectTask(
    context,
    projectId,
    task.id,
    { owner },
    { actor: caller.actor.type === "person" ? "user" : "model" },
  );
  const ownerName = await describeActor(context, owner);

  await postEvent(context, updated, caller, `Assigned to ${ownerName} by ${caller.author.name}.`);

  const actor = caller.actor;
  const assignedToSelf = owner.type === "teammate" && sameWorkActor(owner, actor);

  if (owner.type === "teammate" && !assignedToSelf) {
    await wakeTeammateOnTask(context, updated, owner.id, "assigned", null);
  }

  return (await context.repositories.get(ProjectTaskRepository).getTaskById(task.id)) ?? updated;
}

export async function requestReview(
  context: ServiceContext,
  projectId: string,
  taskId: string,
  reviewer: WorkActor,
  note: string | null,
  caller: WorkCaller,
): Promise<ProjectTask> {
  const task = await requireTaskInProject(context, projectId, taskId);

  if (isTerminalProjectTaskStatus(task.status)) {
    throw new AssistantError("This task is already finished", ErrorType.CONFLICT_ERROR, 409);
  }

  const updated = await context.repositories.get(ProjectTaskRepository).updateTask(task.id, {
    reviewer,
    status: "review",
    blockedReason: null,
    blockedDetail: null,
  });

  if (!updated) {
    throw new AssistantError("Task not found", ErrorType.NOT_FOUND, 404);
  }

  const reviewerName = await describeActor(context, reviewer);

  await postEvent(
    context,
    updated,
    caller,
    `${caller.author.name} asked ${reviewerName} to review.${note ? ` ${note}` : ""}`,
  );
  await reconcileTaskNotifications(context, updated);

  if (reviewer.type === "teammate") {
    await wakeTeammateOnTask(context, updated, reviewer.id, "review", note);
  }

  return updated;
}

export async function reviewTask(
  context: ServiceContext,
  projectId: string,
  taskId: string,
  decision: "accept" | "changes",
  note: string,
  caller: WorkCaller,
): Promise<ProjectTask> {
  const task = await requireTaskInProject(context, projectId, taskId);

  if (task.status !== "review") {
    throw new AssistantError("This task is not waiting for review", ErrorType.CONFLICT_ERROR, 409);
  }

  const actor = caller.actor;

  if (
    actor.type === "teammate" &&
    (task.reviewer?.type !== "teammate" || task.reviewer.id !== actor.id)
  ) {
    throw new AssistantError(
      "Only the named reviewer can review this task",
      ErrorType.FORBIDDEN,
      403,
    );
  }

  if (decision === "accept") {
    if (caller.actor.type === "teammate" && task.completions.length === 0) {
      throw new AssistantError(
        "There is no completed run to accept yet. Ask the owner to finish the work first.",
        ErrorType.CONFLICT_ERROR,
        409,
      );
    }

    await postEvent(
      context,
      task,
      caller,
      `${caller.author.name} accepted the work. ${note}`.trim(),
    );
    const { task: accepted } = await acceptProjectTask(context, projectId, task.id);

    return accepted;
  }

  const rounds = (task.details.reviewRounds ?? 0) + (caller.actor.type === "teammate" ? 1 : 0);
  const handToPerson = caller.actor.type === "teammate" && rounds >= WORK_MAX_AGENT_REVIEW_ROUNDS;
  const responsible = task.runnerIdentityUserId ?? task.createdByUserId;
  const updated = await context.repositories.get(ProjectTaskRepository).updateTask(task.id, {
    status: handToPerson ? "review" : "backlog",
    details: {
      ...task.details,
      reviewRounds: rounds,
      ...(handToPerson
        ? {}
        : {
            fixUp: {
              source: "review" as const,
              from: caller.author.name,
              note,
              at: new Date().toISOString(),
            },
          }),
    },
    ...(handToPerson ? { reviewer: { type: "person", userId: responsible } } : {}),
  });

  if (!updated) {
    throw new AssistantError("Task not found", ErrorType.NOT_FOUND, 404);
  }

  await postEvent(
    context,
    updated,
    caller,
    handToPerson
      ? `${caller.author.name} asked for changes again. After ${rounds} rounds between teammates this goes to a person. ${note}`
      : `${caller.author.name} asked for changes: ${note}`,
  );
  await reconcileTaskNotifications(context, updated);

  if (!handToPerson && updated.owner?.type === "teammate") {
    await wakeTeammateOnTask(context, updated, updated.owner.id, "assigned", note);
  }

  return updated;
}

export async function blockTask(
  context: ServiceContext,
  projectId: string,
  taskId: string,
  reason: string,
  unblocker: WorkActor,
  caller: WorkCaller,
): Promise<ProjectTask> {
  const task = await requireTaskInProject(context, projectId, taskId);

  if (isTerminalProjectTaskStatus(task.status)) {
    throw new AssistantError("This task is already finished", ErrorType.CONFLICT_ERROR, 409);
  }

  const unblockerName = await describeActor(context, unblocker);
  const updated = await context.repositories.get(ProjectTaskRepository).updateTask(task.id, {
    status: "blocked",
    blockedReason: "awaiting_input",
    blockedDetail: `Needs ${unblockerName}: ${reason}`.slice(0, 500),
    details: { ...task.details, unblocker },
  });

  if (!updated) {
    throw new AssistantError("Task not found", ErrorType.NOT_FOUND, 404);
  }

  await postEvent(context, updated, caller, `Blocked. Needs ${unblockerName}: ${reason}`);
  await reconcileTaskNotifications(context, updated);

  if (unblocker.type === "teammate") {
    await enqueueTeammateWake(context, {
      workspaceId: updated.workspaceId,
      teammateId: unblocker.id,
      projectId: updated.projectId,
      reason: "escalation",
      taskId: updated.id,
      detail: reason,
    });
  }

  return updated;
}

export async function escalateTask(
  context: ServiceContext,
  projectId: string,
  taskId: string,
  reason: string,
  caller: WorkCaller,
): Promise<ProjectTask> {
  const task = await requireTaskInProject(context, projectId, taskId);
  const to: WorkActor =
    caller.actor.type === "teammate"
      ? await resolveManager(context, task.workspaceId, caller.actor.id)
      : { type: "person", userId: task.runnerIdentityUserId ?? task.createdByUserId };
  const toName = await describeActor(context, to);
  const updated = await context.repositories.get(ProjectTaskRepository).updateTask(task.id, {
    details: {
      ...task.details,
      escalation: { to, reason, by: caller.actor, at: new Date().toISOString() },
    },
  });

  if (!updated) {
    throw new AssistantError("Task not found", ErrorType.NOT_FOUND, 404);
  }

  await postEvent(context, updated, caller, `Escalated to ${toName}: ${reason}`);

  if (to.type === "teammate") {
    await enqueueTeammateWake(context, {
      workspaceId: updated.workspaceId,
      teammateId: to.id,
      projectId: updated.projectId,
      reason: "escalation",
      taskId: updated.id,
      detail: reason,
    });
  }

  return updated;
}

export async function answerReportQuestions(
  context: ServiceContext,
  projectId: string,
  taskId: string,
  answers: UserQuestionAnswer[],
  caller: WorkCaller,
): Promise<ProjectTask> {
  const task = await requireTaskInProject(context, projectId, taskId);

  if (
    caller.actor.type !== "teammate" ||
    task.owner?.type !== "teammate" ||
    !(await managesTeammate(context, task.workspaceId, caller.actor.id, task.owner.id))
  ) {
    throw new AssistantError(
      "You can only answer questions from teammates who report to you",
      ErrorType.FORBIDDEN,
      403,
    );
  }

  const pending = await getPendingProjectTaskQuestions(context, task);

  if (!pending) {
    throw new AssistantError("This task is not waiting for answers", ErrorType.CONFLICT_ERROR, 409);
  }

  await postEvent(
    context,
    task,
    caller,
    `${caller.author.name} answered ${pending.questions.length === 1 ? "the question" : `${pending.questions.length} questions`}.`,
  );
  await respondToProjectTaskQuestions(context, projectId, task.id, {
    interactionId: pending.interactionId,
    answers,
  });

  return (await context.repositories.get(ProjectTaskRepository).getTaskById(task.id)) ?? task;
}

export async function clearEscalation(
  context: ServiceContext,
  projectId: string,
  taskId: string,
): Promise<ProjectTask> {
  const task = await requireTaskInProject(context, projectId, taskId);
  const updated = await context.repositories
    .get(ProjectTaskRepository)
    .updateTask(task.id, { details: { ...task.details, escalation: undefined } });

  if (!updated) {
    throw new AssistantError("Task not found", ErrorType.NOT_FOUND, 404);
  }

  return updated;
}

export async function linkTasks(
  context: ServiceContext,
  projectId: string,
  taskId: string,
  toTaskId: string,
  kind: ProjectTaskLinkKind,
) {
  const task = await requireTaskInProject(context, projectId, taskId);
  const target = await context.repositories.get(ProjectTaskRepository).getTaskById(toTaskId);

  if (!target || target.workspaceId !== task.workspaceId || target.id === task.id) {
    throw new AssistantError(
      "You can only link tasks in this workspace",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  await requireProjectAccess(context, target.projectId);

  return context.repositories.get(ProjectTaskRepository).createLink({
    workspaceId: task.workspaceId,
    fromTaskId: task.id,
    toTaskId: target.id,
    kind,
  });
}

export async function unlinkTasks(
  context: ServiceContext,
  projectId: string,
  taskId: string,
  linkId: string,
): Promise<void> {
  const task = await requireTaskInProject(context, projectId, taskId);
  const removed = await context.repositories.get(ProjectTaskRepository).deleteLink(linkId, task.id);

  if (!removed) {
    throw new AssistantError("Link not found", ErrorType.NOT_FOUND, 404);
  }
}

export async function raiseCase(
  context: ServiceContext,
  projectId: string,
  input: RaiseCaseInput,
  caller: WorkCaller,
  source: {
    kind: CaseSource;
    address?: string | null;
    requesterName?: string;
    channel?: ProjectTaskCase["channel"];
  } = {
    kind: caller.actor.type,
  },
): Promise<ProjectTask> {
  if (input.raisedFromTaskId) {
    await requireTaskInProject(context, projectId, input.raisedFromTaskId);
  }

  const { task } = await createProjectTask(
    context,
    projectId,
    {
      objective: input.title,
      kind: "case",
      description: input.description,
      priority: input.priority,
    },
    {
      source: caller.actor.type === "teammate" ? "model" : "user",
      details: {
        case: {
          source: source.kind,
          requester: {
            name: source.requesterName ?? caller.author.name,
            userId: caller.actor.type === "person" ? caller.actor.userId : null,
            teammateId: caller.actor.type === "teammate" ? caller.actor.id : null,
            address: source.address ?? null,
          },
          resolution: null,
          resolvedAt: null,
          channel: source.channel ?? null,
          draftReply: null,
        },
      },
    },
  );

  if (input.raisedFromTaskId) {
    const origin = await requireTaskInProject(context, projectId, input.raisedFromTaskId);

    await context.repositories.get(ProjectTaskRepository).createLink({
      workspaceId: task.workspaceId,
      fromTaskId: task.id,
      toTaskId: origin.id,
      kind: "raised_from",
    });
    await postEvent(
      context,
      origin,
      caller,
      `${caller.author.name} raised case ${taskReference(task)} "${task.objective}" and sent it to Triage.`,
    );
  }

  await context.repositories.get(AuditRepository).createRecord({
    workspaceId: task.workspaceId,
    actorUserId: context.requireUser().id,
    action: "project.case.raised",
    targetType: "project_task",
    targetId: task.id,
    metadata: { projectId, source: source.kind, raisedFromTaskId: input.raisedFromTaskId },
  });

  return task;
}

export async function resolveCase(
  context: ServiceContext,
  projectId: string,
  taskId: string,
  resolution: string,
): Promise<ProjectTask> {
  const task = await requireTaskInProject(context, projectId, taskId);

  if (task.kind !== "case" || !task.details.case) {
    throw new AssistantError("Only a case can be resolved", ErrorType.PARAMS_ERROR, 400);
  }

  const resolvedAt = new Date().toISOString();
  const updated = await context.repositories.get(ProjectTaskRepository).updateTask(task.id, {
    status: "done",
    blockedReason: null,
    blockedDetail: null,
    completedAt: resolvedAt,
    details: { ...task.details, case: { ...task.details.case, resolution, resolvedAt } },
  });

  if (!updated) {
    throw new AssistantError("Task not found", ErrorType.NOT_FOUND, 404);
  }

  await postEvent(context, updated, personCaller(context), `Resolved: ${resolution}`);
  await reconcileTaskNotifications(context, updated);

  return updated;
}

export async function draftCaseReply(
  context: ServiceContext,
  projectId: string,
  taskId: string,
  body: string,
  caller: WorkCaller,
): Promise<ProjectTask> {
  const task = await requireTaskInProject(context, projectId, taskId);
  const caseDetail = task.details.case;

  if (task.kind !== "case" || !caseDetail) {
    throw new AssistantError(
      "Only a case has a requester to reply to",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  if (!caseDetail.channel) {
    throw new AssistantError(
      "This case did not arrive through a channel, so there is nowhere to send a reply. Post the answer in the thread instead.",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const updated = await context.repositories.get(ProjectTaskRepository).updateTask(task.id, {
    details: {
      ...task.details,
      case: {
        ...caseDetail,
        draftReply: { body, draftedBy: caller.actor, at: new Date().toISOString() },
      },
    },
  });

  if (!updated) {
    throw new AssistantError("Task not found", ErrorType.NOT_FOUND, 404);
  }

  await postEvent(
    context,
    updated,
    caller,
    `${caller.author.name} drafted a reply to ${caseDetail.requester.name}. It sends only when a person approves it.`,
  );
  await reconcileTaskNotifications(context, updated);

  return updated;
}
