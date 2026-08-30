import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router";

import { apiService } from "~/lib/api/api-service";
import { useStreamActivityStore } from "~/state/stores/streamActivityStore";

interface ProjectConversationActionsOptions {
  activeConversationId?: string;
  projectChatPath: string;
  refreshProject: () => Promise<unknown>;
}

export function useProjectConversationActions({
  activeConversationId,
  projectChatPath,
  refreshProject,
}: ProjectConversationActionsOptions) {
  const navigate = useNavigate();
  const deleteConversation = useMutation({
    mutationFn: (conversationId: string) => apiService.deleteConversation(conversationId),
  });
  const updateTitle = useMutation({
    mutationFn: ({ conversationId, title }: { conversationId: string; title: string }) =>
      apiService.updateConversationTitle(conversationId, title),
  });
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);

  const editConversationTitle = async (conversationId: string, currentTitle: string) => {
    const title = prompt("Enter new title:", currentTitle);

    if (!title || title === currentTitle) {
      return;
    }

    try {
      await updateTitle.mutateAsync({ conversationId, title });
      await refreshProject();
    } catch (error) {
      console.error("Failed to update project conversation title:", error);
      alert("Failed to update the conversation title. Please try again.");
    }
  };

  const confirmDeleteConversation = async () => {
    if (!conversationToDelete) {
      return;
    }

    await deleteConversation.mutateAsync(conversationToDelete);
    useStreamActivityStore.getState().clearStreamStatus(conversationToDelete);
    await refreshProject();

    if (activeConversationId === conversationToDelete) {
      void navigate(projectChatPath);
    }

    setConversationToDelete(null);
  };

  return {
    confirmDeleteConversation,
    conversationToDelete,
    deletePending: deleteConversation.isPending,
    editConversationTitle,
    requestDeleteConversation: setConversationToDelete,
    setConversationToDelete,
  };
}
