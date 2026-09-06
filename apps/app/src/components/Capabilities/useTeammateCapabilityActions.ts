import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import type { TeammateResponse, HireTeammateInput } from "@ngriffin_uk/polychat-schemas";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import { NEW_TEAMMATE_ID } from "~/components/Teammates/useTeammateEditorController";
import { capabilityCatalogQueryKey } from "~/hooks/useCapabilityCatalog";
import { useTeammates } from "~/hooks/useTeammates";
import { useWorkspaces } from "~/hooks/useWorkspaces";
import { getTeammateEditorPath, type CapabilitySurface } from "~/lib/capability-surfaces";
import { resolveTeammateManagePermission } from "~/lib/teammates/teammate-permissions";

export interface TeammateCapabilityActions {
  attachableTeammates: TeammateResponse[];
  canManageTeammate: (teammateId: string) => boolean;
  canShareTeammate: (teammateId: string) => boolean;
  createPath: string;
  deleteTeammate: (teammateId: string) => Promise<void>;
  deletionError: Error | null;
  hireTeammate: (input: HireTeammateInput) => Promise<TeammateResponse>;
  hireError: Error | null;
  isHiring: boolean;
  editPath: (teammateId: string) => string;
  findTeammate: (teammateId: string) => TeammateResponse | undefined;
  isDeleting: boolean;
  isLoadingAttachable: boolean;
  pendingTeammateId?: string;
  refreshCatalogue: () => Promise<void>;
  resetDeletion: () => void;
}

export function useTeammateCapabilityActions(
  surface: CapabilitySurface,
  attachedTeammateIds: readonly string[],
): TeammateCapabilityActions {
  const queryClient = useQueryClient();
  const currentUserId = useChatStore((state) => state.user?.id);
  const workspacesQuery = useWorkspaces();
  const {
    teammates,
    isLoadingTeammates,
    deleteTeammateAsync,
    deleteTeammateError,
    deletingTeammateId,
    isDeletingTeammate,
    resetTeammateDeletion,
    hireTeammate: hireTeammateMutation,
    isHiringTeammate,
    hireTeammateError,
  } = useTeammates();
  const workspaces = useMemo(
    () => workspacesQuery.data?.workspaces ?? [],
    [workspacesQuery.data?.workspaces],
  );
  const manageableTeammateIds = useMemo(
    () =>
      new Set(
        teammates
          .filter(
            (teammate) =>
              resolveTeammateManagePermission(teammate, currentUserId, workspaces).canManage,
          )
          .map((teammate) => teammate.id),
      ),
    [teammates, currentUserId, workspaces],
  );
  const teammateById = useMemo(
    () => new Map(teammates.map((teammate) => [teammate.id, teammate])),
    [teammates],
  );
  const shareableTeammateIds = useMemo(
    () =>
      new Set(
        teammates
          .filter(
            (teammate) =>
              teammate.owner_scope_type === "user" && manageableTeammateIds.has(teammate.id),
          )
          .map((teammate) => teammate.id),
      ),
    [teammates, manageableTeammateIds],
  );
  const attachableTeammates = useMemo(() => {
    if (!surface.workspaceId) {
      return [];
    }

    const attached = new Set(attachedTeammateIds);

    return teammates.filter(
      (teammate) =>
        teammate.owner_scope_type === "workspace" &&
        teammate.owner_scope_id === surface.workspaceId &&
        !attached.has(teammate.id),
    );
  }, [teammates, attachedTeammateIds, surface.workspaceId]);

  const refreshCatalogue = () =>
    queryClient.invalidateQueries({ queryKey: capabilityCatalogQueryKey(surface.projectId) });

  return {
    attachableTeammates,
    canManageTeammate: (teammateId: string) => manageableTeammateIds.has(teammateId),
    canShareTeammate: (teammateId: string) => shareableTeammateIds.has(teammateId),
    createPath: getTeammateEditorPath(surface, NEW_TEAMMATE_ID),
    deleteTeammate: async (teammateId: string) => {
      await deleteTeammateAsync(teammateId);
      await refreshCatalogue();
    },
    deletionError: deleteTeammateError,
    editPath: (teammateId: string) => getTeammateEditorPath(surface, teammateId),
    hireTeammate: async (input: HireTeammateInput) => {
      const hired = await hireTeammateMutation(input);

      await refreshCatalogue();

      return hired;
    },
    hireError: hireTeammateError,
    isHiring: isHiringTeammate,
    findTeammate: (teammateId: string) => teammateById.get(teammateId),
    isDeleting: isDeletingTeammate,
    isLoadingAttachable: isLoadingTeammates || workspacesQuery.isLoading,
    pendingTeammateId: deletingTeammateId,
    refreshCatalogue,
    resetDeletion: resetTeammateDeletion,
  };
}
