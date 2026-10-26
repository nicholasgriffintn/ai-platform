import {
  MANAGER_HANDLED_BLOCKED_REASONS,
  projectTaskBlockedReasonLabels,
  type ProjectTask,
  type UserQuestionSet,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { taskReference } from "~/modules/project-tasks/domain/work-actors";
import { ProjectTaskRepository } from "~/modules/project-tasks/infrastructure/ProjectTaskRepository";
import { enqueueTeammateWake } from "~/modules/teammates/application/wakes";
import { TeammateRepository } from "~/modules/teammates/infrastructure/TeammateRepository";
import {
  WorkspaceTeammateRepository,
  type WorkspaceTeammateRecord,
} from "~/modules/teammates/infrastructure/WorkspaceTeammateRepository";

import { getPendingProjectTaskQuestions } from "./questions";

function describeQuestions(questions: UserQuestionSet): string {
  return questions.questions
    .map((question, index) => {
      const options = question.options.map((option) => option.label).join(" / ");

      return `${index + 1}. [${question.id}] ${question.prompt}${options ? ` (options: ${options})` : ""}`;
    })
    .join("\n");
}

function buildHandoffDetail(params: {
  task: ProjectTask;
  ownerName: string;
  questions: UserQuestionSet | null;
}): string {
  const { task, ownerName, questions } = params;
  const key = taskReference(task);

  if (questions) {
    return [
      `${ownerName} is waiting on these questions on ${key}:`,
      describeQuestions(questions),
      "Answer them from the mission, initiatives, the setup plan, answers already given on other tasks and your memory, then call answer_questions with every question answered. If some need facts only the person has, do not guess: escalate the task once, saying what you already know and exactly what is still missing, so the person answers in one go.",
    ].join("\n");
  }

  if (task.blockedReason === "awaiting_input") {
    return [
      `${ownerName} is waiting on answers on ${key}${task.blockedDetail ? `: ${task.blockedDetail}` : "."}`,
      "Read the questions with get_task, answer them from the mission, initiatives, the setup plan, answers already given on other tasks and your memory, then call answer_questions with every question answered. If some need facts only the person has, do not guess: escalate the task once, saying what you already know and exactly what is still missing, so the person answers in one go.",
    ].join("\n");
  }

  const reason = task.blockedReason
    ? projectTaskBlockedReasonLabels[task.blockedReason]
    : "Blocked";

  return [
    `${key}, owned by ${ownerName}, is blocked: ${reason}${task.blockedDetail ? ` — ${task.blockedDetail}` : ""}.`,
    "Read it with get_task. If a clearer brief or a retry would fix it, add what is missing with post_update and assign_task it back to its owner to run again. If another teammate fits better, assign it to them. Escalate only when it needs the person: money, access, an approval or a decision outside the mission.",
  ].join("\n");
}

function reportOwnerId(task: ProjectTask): string | null {
  return task.kind === "task" &&
    task.status === "blocked" &&
    task.blockedReason !== null &&
    MANAGER_HANDLED_BLOCKED_REASONS.includes(task.blockedReason) &&
    task.owner?.type === "teammate" &&
    task.details.escalation?.to.type !== "person"
    ? task.owner.id
    : null;
}

export function findHandlingManager(
  task: ProjectTask,
  team: readonly WorkspaceTeammateRecord[],
): string | null {
  const ownerId = reportOwnerId(task);

  if (!ownerId) {
    return null;
  }

  const managerId = team.find((member) => member.teammateId === ownerId)?.reportsToTeammateId;
  const manager = team.find((member) => member.teammateId === managerId);

  return manager && manager.status === "active" && manager.teammateId !== ownerId
    ? manager.teammateId
    : null;
}

export async function handBlockedTaskToManager(
  context: ServiceContext,
  task: ProjectTask,
): Promise<boolean> {
  const ownerId = reportOwnerId(task);

  if (!ownerId) {
    return false;
  }

  const team = await context.repositories
    .get(WorkspaceTeammateRepository)
    .listForWorkspace(task.workspaceId);
  const managerId = findHandlingManager(task, team);

  if (!managerId) {
    return false;
  }

  const [owner, questions] = await Promise.all([
    context.repositories.get(TeammateRepository).getTeammateById(ownerId),
    task.blockedReason === "awaiting_input"
      ? getPendingProjectTaskQuestions(context, task)
      : Promise.resolve(null),
  ]);

  await context.repositories.get(ProjectTaskRepository).updateTask(task.id, {
    details: {
      ...task.details,
      handoff: { teammateId: managerId, version: task.attentionVersion ?? 0 },
    },
  });
  await enqueueTeammateWake(context, {
    workspaceId: task.workspaceId,
    teammateId: managerId,
    projectId: task.projectId,
    reason: "report_blocked",
    taskId: task.id,
    detail: buildHandoffDetail({ task, ownerName: owner?.name ?? "Your report", questions }),
  });

  return true;
}
