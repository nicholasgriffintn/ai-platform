import {
  AgentFormModal,
  AgentsList,
  ConfirmDeleteModal,
  ShareAgentModal,
} from "@ngriffin_uk/polychat-component-account";
import type { AgentFormData } from "@ngriffin_uk/polychat-component-account";
import type { AgentResponse } from "@ngriffin_uk/polychat-schemas";
import { EMPTY_MODEL_CONFIG } from "@ngriffin_uk/polychat-schemas";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageShell } from "~/components/Core/PageShell";
import { useAgents } from "~/hooks/useAgents";
import { useModels } from "~/hooks/useModels";
import { useSharedAgents } from "~/hooks/useSharedAgents";
import { useTools } from "~/hooks/useTools";

import { SharedAgentsBrowser } from "./SharedAgentsBrowser";

export function ProfileAgentsTab() {
  const {
    groupedAgents,
    isLoadingAgents,
    createAgent,
    isCreatingAgent,
    updateAgent,
    isUpdatingAgent,
    deleteAgent,
    isDeletingAgent,
  } = useAgents();

  const { data: apiModels = EMPTY_MODEL_CONFIG } = useModels();

  const { installSharedAgent, isInstalling, shareAgent, isSharing, categories } = useSharedAgents();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AgentResponse | null>(null);
  const [agentToDelete, setAgentToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [agentToShare, setAgentToShare] = useState<AgentResponse | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const { data: tools, isLoading: isLoadingTools } = useTools();

  const handleCreateClick = () => {
    setEditingAgent(null);
    setModalOpen(true);
  };

  const handleEditClick = (agent: AgentResponse) => {
    setEditingAgent(agent);
    setModalOpen(true);
  };

  const handleDeleteClick = (agentId: string, agentName: string) => {
    setAgentToDelete({ id: agentId, name: agentName });
  };

  const handleShareClick = (agent: AgentResponse) => {
    setAgentToShare(agent);
    setShareModalOpen(true);
  };

  const handleFormSubmit = async (
    agentData: AgentFormData,
    isEdit: boolean,
    agentId: string | null,
  ) => {
    try {
      if (isEdit && agentId) {
        await updateAgent({
          id: agentId,
          data: agentData,
        });
        toast.success("Agent updated successfully");
      } else {
        await createAgent(agentData);
        toast.success("Agent created successfully");
      }

      setModalOpen(false);
      setEditingAgent(null);
    } catch (error) {
      toast.error(isEdit ? "Failed to update agent" : "Failed to create agent");
      console.error(error);
    }
  };

  const handleConfirmDelete = () => {
    if (agentToDelete) {
      deleteAgent(agentToDelete.id, {
        onSuccess: () => {
          toast.success(`Agent "${agentToDelete.name}" deleted`);
          setAgentToDelete(null);
        },
        onError: (error) => {
          toast.error(`Failed to delete agent: ${error.message || "Unknown error"}`);
          console.error("Delete error:", error);
        },
      });
    }
  };

  const handleConfirmShare = async (data: {
    name: string;
    description: string;
    category: string;
    tags: string[];
  }) => {
    if (agentToShare) {
      await shareAgent({
        agentId: agentToShare.id,
        name: data.name,
        description: data.description || undefined,
        avatarUrl: agentToShare.avatar_url || undefined,
        category: data.category || undefined,
        tags: data.tags,
      });
      setShareModalOpen(false);
      setAgentToShare(null);
    }
  };

  return (
    <div className="space-y-8">
      <PageShell.Header
        title="Agents"
        actions={[
          {
            label: "Add Agent",
            onClick: handleCreateClick,
            icon: <Plus className="mr-2 h-4 w-4" />,
            variant: "primary",
          },
        ]}
      />

      <AgentsList
        groupedAgents={groupedAgents}
        isLoading={isLoadingAgents}
        onEdit={handleEditClick}
        onShare={handleShareClick}
        onDelete={handleDeleteClick}
        isUpdating={isUpdatingAgent}
        isSharing={isSharing}
        isDeleting={isDeletingAgent}
        currentAgentId={editingAgent?.id || null}
        agentToShare={agentToShare}
        agentToDelete={agentToDelete}
      />

      <SharedAgentsBrowser onInstall={installSharedAgent} isInstalling={isInstalling} />

      <AgentFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingAgent(null);
        }}
        onSubmit={handleFormSubmit}
        isSubmitting={isCreatingAgent || isUpdatingAgent}
        apiModels={apiModels}
        groupedAgents={groupedAgents}
        agent={editingAgent}
        tools={tools}
        isLoadingTools={isLoadingTools}
      />

      {agentToDelete && (
        <ConfirmDeleteModal
          isOpen={!!agentToDelete}
          onClose={() => setAgentToDelete(null)}
          onConfirm={handleConfirmDelete}
          agentName={agentToDelete.name}
          isDeleting={isDeletingAgent}
        />
      )}

      <ShareAgentModal
        open={shareModalOpen}
        onClose={() => {
          setShareModalOpen(false);
          setAgentToShare(null);
        }}
        onShare={handleConfirmShare}
        isSharing={isSharing}
        agent={agentToShare}
        categories={categories}
      />
    </div>
  );
}
