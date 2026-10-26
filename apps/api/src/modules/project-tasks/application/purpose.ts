import type { ProjectTask } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { ProjectTaskRepository } from "~/modules/project-tasks/infrastructure/ProjectTaskRepository";
import { InitiativeRepository } from "~/modules/workspaces/infrastructure/InitiativeRepository";
import { WorkspaceRepository } from "~/modules/workspaces/infrastructure/WorkspaceRepository";

export async function buildWorkPurpose(
  context: ServiceContext,
  task: ProjectTask,
): Promise<string | null> {
  const workspaces = context.repositories.get(WorkspaceRepository);
  const [workspace, project, parent] = await Promise.all([
    workspaces.getWorkspace(task.workspaceId),
    workspaces.getProject(task.projectId),
    task.parentTaskId
      ? context.repositories.get(ProjectTaskRepository).getTaskById(task.parentTaskId)
      : null,
  ]);
  const initiative = project?.initiative_id
    ? await context.repositories.get(InitiativeRepository).getById(project.initiative_id)
    : null;
  const lines = [
    workspace?.mission ? `Mission: ${workspace.mission}` : null,
    initiative ? `Initiative: ${initiative.name}` : null,
    project ? `Project: ${project.name}` : null,
    parent ? `Parent task: ${parent.key ?? parent.id} ${parent.objective}` : null,
    task.key ? `This task: ${task.key}` : null,
  ].filter((line): line is string => Boolean(line));

  return lines.length > 1 ? `Why this work matters:\n${lines.join("\n")}` : null;
}
