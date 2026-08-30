import { useMemo, type ReactNode } from "react";

import { useProject, useWorkspace, useWorkspaces } from "~/hooks/useWorkspaces";

import { WorkContext } from "./WorkDataContext";

export function WorkDataProvider({
  children,
  projectId,
  workspaceId,
}: {
  children: ReactNode;
  projectId?: string;
  workspaceId?: string;
}) {
  const workspacesQuery = useWorkspaces();
  const workspaceQuery = useWorkspace(workspaceId);
  const projectQuery = useProject(projectId, workspaceId);
  const value = useMemo(
    () => ({
      projectId,
      projectQuery,
      workspaceId,
      workspaceQuery,
      workspacesQuery,
    }),
    [projectId, projectQuery, workspaceId, workspaceQuery, workspacesQuery],
  );

  return <WorkContext.Provider value={value}>{children}</WorkContext.Provider>;
}
