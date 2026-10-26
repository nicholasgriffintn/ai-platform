import type { WorkDirectory } from "@ngriffin_uk/polychat-component-workspaces";
import { useWorkspace, useWorkspaceTeamDirectory } from "@ngriffin_uk/polychat-library-react";

export function useWorkDirectory(workspaceId: string) {
  const workspaceQuery = useWorkspace(workspaceId);
  const teamQuery = useWorkspaceTeamDirectory(workspaceId);
  const team = teamQuery.data?.teammates ?? [];
  const directory: WorkDirectory = {
    people: (workspaceQuery.data?.members ?? []).map((member) => ({
      userId: member.userId,
      name: member.name,
    })),
    teammates: team.map((teammate) => ({
      id: teammate.teammateId,
      name: teammate.name,
      assignable: teammate.status === "active",
    })),
  };

  return {
    directory,
    team,
    leadTeammateId: teamQuery.data?.leadTeammateId ?? null,
    workspaceQuery,
  };
}
