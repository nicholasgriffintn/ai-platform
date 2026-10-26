import type { SetupPlanCreated } from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { ProjectTaskRepository } from "~/modules/project-tasks/infrastructure/ProjectTaskRepository";
import { deleteTeammate } from "~/modules/teammates/application/teammateCrud";
import { WorkspaceTeammateRepository } from "~/modules/teammates/infrastructure/WorkspaceTeammateRepository";
import { InitiativeRepository } from "~/modules/workspaces/infrastructure/InitiativeRepository";
import { WorkspaceRepository } from "~/modules/workspaces/infrastructure/WorkspaceRepository";

export async function rollBackSetupCreation(
  context: ServiceContext,
  workspaceId: string,
  created: SetupPlanCreated,
): Promise<string[]> {
  const problems: string[] = [];
  const attempt = async (label: string, step: () => Promise<unknown>) => {
    try {
      await step();
    } catch (error) {
      problems.push(`${label}: ${getErrorMessage(error, "failed")}`);
    }
  };

  const workspaces = context.repositories.get(WorkspaceRepository);
  const now = new Date().toISOString();

  for (const taskId of created.taskIds) {
    await attempt(`task ${taskId}`, () =>
      context.repositories.get(ProjectTaskRepository).deleteTask(taskId),
    );
  }

  for (const teammateId of created.teammateIds) {
    await attempt(`teammate ${teammateId}`, async () => {
      for (const projectId of created.projectIds) {
        await workspaces.removeProjectCapabilityByCapabilityId(projectId, "teammate", teammateId);
      }

      await context.repositories.get(WorkspaceTeammateRepository).delete(workspaceId, teammateId);
      await deleteTeammate(context, teammateId);
    });
  }

  for (const projectId of created.projectIds) {
    await attempt(`project ${projectId}`, () =>
      workspaces.updateProject(projectId, { archived_at: now }),
    );
  }

  for (const initiativeId of created.initiativeIds) {
    await attempt(`initiative ${initiativeId}`, () =>
      context.repositories.get(InitiativeRepository).delete(initiativeId),
    );
  }

  return problems;
}
