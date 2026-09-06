import type {
  TeammateFormData,
  TeammatePublishState,
} from "@ngriffin_uk/polychat-component-account";
import type {
  TeammateResponse,
  ModelConfig,
  SkillSummary,
  Tool,
} from "@ngriffin_uk/polychat-schemas";
import { EMPTY_MODEL_CONFIG } from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { useCapabilityCatalog } from "~/hooks/useCapabilityCatalog";
import { useModels } from "~/hooks/useModels";
import { useTeammate, useTeammates, usePublishTeammateToWorkspace } from "~/hooks/useTeammates";
import { useTools } from "~/hooks/useTools";
import { useWorkspaces } from "~/hooks/useWorkspaces";
import {
  getTeammatePublishTargets,
  resolveTeammateManagePermission,
} from "~/lib/teammates/teammate-permissions";
import { useChatStore } from "~/state/stores/chatStore";

export const NEW_TEAMMATE_ID = "new";

export interface TeammateEditorControllerOptions {
  teammateId: string;
  teammatesPath: string;
  backPath: string;
  projectId?: string;
}

export interface TeammateEditorController {
  teammate: TeammateResponse | null;
  models: ModelConfig;
  tools: Tool[];
  skills: SkillSummary[];
  isLoading: boolean;
  isLoadingCapabilities: boolean;
  loadError: Error | null;
  canManage: boolean;
  cannotManageReason?: string;
  ownerLabel: string;
  isSaving: boolean;
  isDeleting: boolean;
  saveError: string | null;
  publish?: TeammatePublishState;
  deleteRequested: boolean;
  requestDelete: () => void;
  cancelDelete: () => void;
  confirmDelete: () => void;
  submit: (data: TeammateFormData) => void;
  cancel: () => void;
}

export function useTeammateEditorController({
  teammateId,
  teammatesPath,
  backPath,
  projectId,
}: TeammateEditorControllerOptions): TeammateEditorController {
  const isCreate = teammateId === NEW_TEAMMATE_ID;
  const navigate = useNavigate();
  const currentUserId = useChatStore((state) => state.user?.id);
  const teammateQuery = useTeammate(isCreate ? undefined : teammateId);
  const modelsQuery = useModels();
  const toolsQuery = useTools();
  const catalogQuery = useCapabilityCatalog(projectId);
  const workspacesQuery = useWorkspaces();
  const publishMutation = usePublishTeammateToWorkspace();
  const {
    createTeammate,
    isCreatingTeammate,
    updateTeammate,
    isUpdatingTeammate,
    deleteTeammate,
    isDeletingTeammate,
  } = useTeammates({ enabled: false });
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteRequested, setDeleteRequested] = useState(false);

  const teammate = isCreate ? null : (teammateQuery.data ?? null);
  const workspaces = workspacesQuery.data?.workspaces ?? [];
  const permission = resolveTeammateManagePermission(teammate, currentUserId, workspaces);
  const publishTargets = getTeammatePublishTargets(workspaces);

  const save = async (data: TeammateFormData) => {
    setSaveError(null);

    try {
      if (teammate) {
        await updateTeammate({ id: teammate.id, data });
        toast.success("Teammate saved");

        return;
      }

      const created = await createTeammate(data);

      toast.success("Teammate created");
      await navigate(`${teammatesPath}/${created.id}`, { replace: true });
    } catch (error) {
      setSaveError(getErrorMessage(error, "Could not save this teammate."));
    }
  };

  const confirmDelete = () => {
    if (!teammate) {
      return;
    }

    deleteTeammate(teammate.id, {
      onSuccess: () => {
        setDeleteRequested(false);
        toast.success(`Teammate "${teammate.name}" deleted`);
        void navigate(backPath);
      },
      onError: (error) => {
        setDeleteRequested(false);
        setSaveError(getErrorMessage(error, "Could not delete this teammate."));
      },
    });
  };

  const publishToWorkspace = async (targetTeammateId: string, workspaceId: string) => {
    const published = await publishMutation
      .mutateAsync({ teammateId: targetTeammateId, workspaceId })
      .catch(() => null);

    if (published) {
      toast.success("Teammate published to the workspace");
    }
  };

  const publish: TeammatePublishState | undefined =
    teammate && teammate.owner_scope_type === "user" && permission.canManage
      ? {
          workspaces: publishTargets,
          isPublishing: publishMutation.isPending,
          error: publishMutation.error
            ? getErrorMessage(publishMutation.error, "Could not publish this teammate.")
            : null,
          onPublish: (workspaceId: string) => {
            void publishToWorkspace(teammate.id, workspaceId);
          },
        }
      : undefined;

  return {
    teammate,
    models: modelsQuery.data ?? EMPTY_MODEL_CONFIG,
    tools: toolsQuery.data ?? [],
    skills: catalogQuery.data?.skills ?? [],
    isLoading: (!isCreate && teammateQuery.isLoading) || modelsQuery.isLoading,
    isLoadingCapabilities: toolsQuery.isLoading || catalogQuery.isLoading,
    loadError: teammateQuery.error,
    canManage: permission.canManage,
    cannotManageReason: permission.reason,
    ownerLabel: permission.ownerLabel,
    isSaving: isCreatingTeammate || isUpdatingTeammate,
    isDeleting: isDeletingTeammate,
    saveError,
    publish,
    deleteRequested,
    requestDelete: () => setDeleteRequested(true),
    cancelDelete: () => setDeleteRequested(false),
    confirmDelete,
    submit: (data: TeammateFormData) => {
      void save(data);
    },
    cancel: () => {
      void navigate(backPath);
    },
  };
}
