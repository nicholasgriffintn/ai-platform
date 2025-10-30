import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "~/components/Core/PageHeader";
import { PageTitle } from "~/components/Core/PageTitle";
import { type AgentData, useAgents } from "~/hooks/useAgents";
import { useModels } from "~/hooks/useModels";
import { useSharedAgents } from "~/hooks/useSharedAgents";
import { AgentFormModal } from "./AgentFormModal";
import { AgentsList } from "./AgentsList";
import { ConfirmDeleteModal } from "../Modals/ConfirmDeleteModal";
import { ShareAgentModal } from "./ShareAgentModal";
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

  const { data: apiModels = {} } = useModels();

  const {
    installSharedAgent,
    isInstalling,
    shareAgent,
    isSharing,
    categories,
  } = useSharedAgents();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<any>(null);
  const [agentToDelete, setAgentToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [agentToShare, setAgentToShare] = useState<{
    id: string;
    name: string;
    description?: string;
    avatar_url?: string;
  } | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  const handleCreateClick = () => {
    setEditingAgent(null);
    setModalOpen(true);
  };

  const handleEditClick = (agent: any) => {
    setEditingAgent(agent);
    setModalOpen(true);
  };

  const handleDeleteClick = (agentId: string, agentName: string) => {
    setAgentToDelete({ id: agentId, name: agentName });
  };

  const handleShareClick = (agent: any) => {
    setAgentToShare(agent);
    setShareModalOpen(true);
  };

  const handleFormSubmit = async (
    agentData: AgentData,
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
          toast.error(
            `Failed to delete agent: ${error.message || "Unknown error"}`,
          );
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
      <PageHeader
        actions={[
          {
            label: "Add Agent",
            onClick: handleCreateClick,
            icon: <Plus className="mr-2 h-4 w-4" />,
            variant: "primary",
          },
        ]}
      >
        <PageTitle title="Agents" />
      </PageHeader>

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

      <SharedAgentsBrowser
        onInstall={installSharedAgent}
        isInstalling={isInstalling}
      />

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
