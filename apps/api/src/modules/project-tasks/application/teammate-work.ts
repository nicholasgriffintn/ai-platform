import { isTerminalProjectTaskStatus, type ProjectTask } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { ProjectTaskRepository } from "~/modules/project-tasks/infrastructure/ProjectTaskRepository";

import { taskReference } from "../domain/work-actors";

export interface TeammateWorkload {
  ownTasks: string[];
  reviewTasks: string[];
  teamTasks: string[];
  cases: string[];
}

function formatTaskLine(task: ProjectTask): string {
  const blocked = task.blockedDetail ? ` — ${task.blockedDetail}` : "";
  const priority = task.priority !== "none" ? `, ${task.priority}` : "";

  return `- ${taskReference(task)} [${task.status}${priority}] ${task.objective}${blocked}`;
}

function ownedBy(task: ProjectTask, teammateIds: ReadonlySet<string>): boolean {
  return task.owner?.type === "teammate" && teammateIds.has(task.owner.id);
}

export async function describeTeammateWorkload(
  context: ServiceContext,
  params: {
    projectId: string;
    teammateId: string;
    reportIds: readonly string[];
    isLead: boolean;
  },
): Promise<TeammateWorkload> {
  const open = (
    await context.repositories.get(ProjectTaskRepository).listProjectTasks(params.projectId, {})
  ).filter((task) => !isTerminalProjectTaskStatus(task.status));
  const self = new Set([params.teammateId]);
  const reports = new Set(params.reportIds);

  return {
    ownTasks: open.filter((task) => ownedBy(task, self)).map(formatTaskLine),
    reviewTasks: open
      .filter(
        (task) =>
          task.status === "review" &&
          task.reviewer?.type === "teammate" &&
          task.reviewer.id === params.teammateId,
      )
      .map(formatTaskLine),
    teamTasks: open
      .filter(
        (task) => ownedBy(task, reports) && (task.status === "blocked" || task.status === "review"),
      )
      .map(formatTaskLine),
    cases: params.isLead
      ? open
          .filter((task) => task.kind === "case" && !task.owner && task.status === "backlog")
          .map(formatTaskLine)
      : [],
  };
}

export async function listTeammateWorkProjectIds(
  context: ServiceContext,
  params: { workspaceId: string; teammateId: string | null; limit: number },
): Promise<string[]> {
  return context.repositories
    .get(ProjectTaskRepository)
    .listOpenProjectIds(params.workspaceId, params.teammateId, params.limit);
}

export async function findProjectTask(
  context: ServiceContext,
  projectId: string,
  taskId: string,
): Promise<ProjectTask | null> {
  const task = await context.repositories.get(ProjectTaskRepository).getTaskById(taskId);

  return task?.projectId === projectId ? task : null;
}
