import type {
  WorkspaceTeamDirectoryEntry,
  WorkspaceTeamDirectoryResponse,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { TeammateRepository } from "~/modules/teammates/infrastructure/TeammateRepository";
import { WorkspaceTeammateRepository } from "~/modules/teammates/infrastructure/WorkspaceTeammateRepository";
import { requireWorkspaceAccess } from "~/modules/workspaces/application/access";

export async function listWorkspaceTeamDirectory(
  context: ServiceContext,
  workspaceId: string,
): Promise<WorkspaceTeamDirectoryEntry[]> {
  const team = await context.repositories
    .get(WorkspaceTeammateRepository)
    .listForWorkspace(workspaceId);
  const teammates = await context.repositories
    .get(TeammateRepository)
    .getTeammatesByIds(team.map((member) => member.teammateId));
  const names = new Map(teammates.map((teammate) => [teammate.id, teammate.name]));

  return team.flatMap((member) => {
    const name = names.get(member.teammateId);

    return name
      ? [
          {
            teammateId: member.teammateId,
            name,
            title: member.title,
            status: member.status,
            reportsToTeammateId: member.reportsToTeammateId,
            projectIds: member.projectIds,
          },
        ]
      : [];
  });
}

export async function listActiveWorkspaceTeammates(
  context: ServiceContext,
  workspaceId: string,
): Promise<WorkspaceTeamDirectoryEntry[]> {
  return (await listWorkspaceTeamDirectory(context, workspaceId)).filter(
    (member) => member.status === "active",
  );
}

export async function getWorkspaceTeamDirectory(
  context: ServiceContext,
  workspaceId: string,
): Promise<WorkspaceTeamDirectoryResponse> {
  const { workspace } = await requireWorkspaceAccess(context, workspaceId);

  return {
    teammates: await listWorkspaceTeamDirectory(context, workspaceId),
    leadTeammateId: workspace.lead_teammate_id ?? null,
  };
}
