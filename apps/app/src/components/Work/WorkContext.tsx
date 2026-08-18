import { createContext, useContext, useMemo, type ReactNode } from "react";

import { useProject, useWorkspace, useWorkspaces } from "~/hooks/useWorkspaces";

interface WorkContextValue {
  projectId?: string;
  projectQuery: ReturnType<typeof useProject>;
  workspaceId?: string;
  workspaceQuery: ReturnType<typeof useWorkspace>;
  workspacesQuery: ReturnType<typeof useWorkspaces>;
}

const WorkContext = createContext<WorkContextValue | null>(null);

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

export function useWorkData() {
  const context = useContext(WorkContext);

  if (!context) {
    throw new Error("useWorkData must be used inside WorkDataProvider");
  }

  return context;
}
