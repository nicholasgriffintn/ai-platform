import type { AgentFormData, AgentPublishState } from "@ngriffin_uk/polychat-component-account";
import type { AgentResponse, ModelConfig, SkillSummary, Tool } from "@ngriffin_uk/polychat-schemas";
import { EMPTY_MODEL_CONFIG } from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { useAgent, useAgents, usePublishAgentToWorkspace } from "~/hooks/useAgents";
import { useCapabilityCatalog } from "~/hooks/useCapabilityCatalog";
import { useModels } from "~/hooks/useModels";
import { useTools } from "~/hooks/useTools";
import { useWorkspaces } from "~/hooks/useWorkspaces";
import {
  getAgentPublishTargets,
  resolveAgentManagePermission,
} from "~/lib/agents/agent-permissions";
import { useChatStore } from "~/state/stores/chatStore";

export const NEW_AGENT_ID = "new";

export interface AgentEditorControllerOptions {
  agentId: string;
  agentsPath: string;
  backPath: string;
  projectId?: string;
}

export interface AgentEditorController {
  agent: AgentResponse | null;
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
  publish?: AgentPublishState;
  deleteRequested: boolean;
  requestDelete: () => void;
  cancelDelete: () => void;
  confirmDelete: () => void;
  submit: (data: AgentFormData) => void;
  cancel: () => void;
}

export function useAgentEditorController({
  agentId,
  agentsPath,
  backPath,
  projectId,
}: AgentEditorControllerOptions): AgentEditorController {
  const isCreate = agentId === NEW_AGENT_ID;
  const navigate = useNavigate();
  const currentUserId = useChatStore((state) => state.user?.id);
  const agentQuery = useAgent(isCreate ? undefined : agentId);
  const modelsQuery = useModels();
  const toolsQuery = useTools();
  const catalogQuery = useCapabilityCatalog(projectId);
  const workspacesQuery = useWorkspaces();
  const publishMutation = usePublishAgentToWorkspace();
  const {
    createAgent,
    isCreatingAgent,
    updateAgent,
    isUpdatingAgent,
    deleteAgent,
    isDeletingAgent,
  } = useAgents({ enabled: false });
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteRequested, setDeleteRequested] = useState(false);

  const agent = isCreate ? null : (agentQuery.data ?? null);
  const workspaces = workspacesQuery.data?.workspaces ?? [];
  const permission = resolveAgentManagePermission(agent, currentUserId, workspaces);
  const publishTargets = getAgentPublishTargets(workspaces);

  const save = async (data: AgentFormData) => {
    setSaveError(null);

    try {
      if (agent) {
        await updateAgent({ id: agent.id, data });
        toast.success("Agent saved");

        return;
      }

      const created = await createAgent(data);

      toast.success("Agent created");
      await navigate(`${agentsPath}/${created.id}`, { replace: true });
    } catch (error) {
      setSaveError(getErrorMessage(error, "Could not save this agent."));
    }
  };

  const confirmDelete = () => {
    if (!agent) {
      return;
    }

    deleteAgent(agent.id, {
      onSuccess: () => {
        setDeleteRequested(false);
        toast.success(`Agent "${agent.name}" deleted`);
        void navigate(backPath);
      },
      onError: (error) => {
        setDeleteRequested(false);
        setSaveError(getErrorMessage(error, "Could not delete this agent."));
      },
    });
  };

  const publishToWorkspace = async (targetAgentId: string, workspaceId: string) => {
    const published = await publishMutation
      .mutateAsync({ agentId: targetAgentId, workspaceId })
      .catch(() => null);

    if (published) {
      toast.success("Agent published to the workspace");
    }
  };

  const publish: AgentPublishState | undefined =
    agent && agent.owner_scope_type === "user" && permission.canManage
      ? {
          workspaces: publishTargets,
          isPublishing: publishMutation.isPending,
          error: publishMutation.error
            ? getErrorMessage(publishMutation.error, "Could not publish this agent.")
            : null,
          onPublish: (workspaceId: string) => {
            void publishToWorkspace(agent.id, workspaceId);
          },
        }
      : undefined;

  return {
    agent,
    models: modelsQuery.data ?? EMPTY_MODEL_CONFIG,
    tools: toolsQuery.data ?? [],
    skills: catalogQuery.data?.skills ?? [],
    isLoading: (!isCreate && agentQuery.isLoading) || modelsQuery.isLoading,
    isLoadingCapabilities: toolsQuery.isLoading || catalogQuery.isLoading,
    loadError: agentQuery.error,
    canManage: permission.canManage,
    cannotManageReason: permission.reason,
    ownerLabel: permission.ownerLabel,
    isSaving: isCreatingAgent || isUpdatingAgent,
    isDeleting: isDeletingAgent,
    saveError,
    publish,
    deleteRequested,
    requestDelete: () => setDeleteRequested(true),
    cancelDelete: () => setDeleteRequested(false),
    confirmDelete,
    submit: (data: AgentFormData) => {
      void save(data);
    },
    cancel: () => {
      void navigate(backPath);
    },
  };
}
