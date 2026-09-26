import { useMyModelPermissions } from "@ngriffin_uk/polychat-library-react";
import type { ModelPlatformAction } from "@ngriffin_uk/polychat-schemas";
import { createContext, type ReactNode, useContext, useMemo } from "react";
import { useNavigate } from "react-router";

import {
  type ModelObjectKind,
  type ModelPlace,
  modelObjectPath,
  modelsPath,
} from "./modelPaths.js";

interface ModelsScopeValue {
  workspaceId: string;
  projectId?: string;
  can: (action: ModelPlatformAction) => boolean;
  open: (kind: ModelObjectKind, id: string) => void;
  goTo: (place: ModelPlace) => void;
}

const ModelsScopeContext = createContext<ModelsScopeValue | null>(null);

export function ModelsScopeProvider({
  workspaceId,
  projectId,
  children,
}: {
  workspaceId: string;
  projectId?: string;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const permissions = useMyModelPermissions(workspaceId);
  const granted = permissions.data?.actions;
  const value = useMemo<ModelsScopeValue>(() => {
    const actions = new Set(granted ?? []);

    return {
      workspaceId,
      projectId,
      can: (action) => actions.has(action),
      open: (kind, id) => void navigate(modelObjectPath(workspaceId, kind, id, projectId)),
      goTo: (place) => void navigate(modelsPath(workspaceId, projectId, place)),
    };
  }, [granted, navigate, projectId, workspaceId]);

  return <ModelsScopeContext.Provider value={value}>{children}</ModelsScopeContext.Provider>;
}

export function useModelsScope(): ModelsScopeValue {
  const value = useContext(ModelsScopeContext);

  if (!value) {
    throw new Error("useModelsScope must be used inside ModelsScopeProvider");
  }

  return value;
}
