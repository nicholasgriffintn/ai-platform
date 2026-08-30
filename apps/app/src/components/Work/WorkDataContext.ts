import { createContext, type Context, useContext } from "react";

import type { useProject, useWorkspace, useWorkspaces } from "~/hooks/useWorkspaces";

export interface WorkContextValue {
  projectId?: string;
  projectQuery: ReturnType<typeof useProject>;
  workspaceId?: string;
  workspaceQuery: ReturnType<typeof useWorkspace>;
  workspacesQuery: ReturnType<typeof useWorkspaces>;
}

export interface WorkContextHotData {
  workDataContext?: Context<WorkContextValue | null>;
}

export function getWorkDataContext(hotData?: WorkContextHotData): Context<WorkContextValue | null> {
  if (!hotData) {
    return createContext<WorkContextValue | null>(null);
  }

  hotData.workDataContext ??= createContext<WorkContextValue | null>(null);

  return hotData.workDataContext;
}

export const WorkContext = getWorkDataContext(import.meta.hot?.data);

export function useWorkData() {
  const context = useContext(WorkContext);

  if (!context) {
    throw new Error("useWorkData must be used inside WorkDataProvider");
  }

  return context;
}
