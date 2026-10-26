import type { WorkDirectory } from "@ngriffin_uk/polychat-component-workspaces";
import { useWorkspace, useWorkspaceTeam } from "@ngriffin_uk/polychat-library-react";

export function useWorkDirectory(workspaceId: string) {
  const workspaceQuery = useWorkspace(workspaceId);
  const teamQuery = useWorkspaceTeam(workspaceId);
  const team = teamQuery.data?.teammates ?? [];
  const directory: WorkDirectory = {
    people: (workspaceQuery.data?.members ?? []).map((member) => ({
      userId: member.userId,
      name: member.name,
    })),
    teammates: team
      .filter((teammate) => teammate.status === "active")
      .map((teammate) => ({ id: teammate.teammateId, name: teammate.name })),
  };

  return { directory, team, teamQuery, workspaceQuery };
}
