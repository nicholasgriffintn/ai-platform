import { apiService, useStreamActivityStore } from "@ngriffin_uk/polychat-library-client";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import type { RenameConversationTarget } from "../Conversations/RenameConversationDialog.js";

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
  const [conversationToRename, setConversationToRename] = useState<RenameConversationTarget | null>(
    null,
  );

  const renameConversation = async (conversationId: string, title: string) => {
    try {
      await updateTitle.mutateAsync({ conversationId, title });
      await refreshProject();
      setConversationToRename(null);
    } catch (error) {
      console.error("Failed to update project conversation title:", error);
      toast.error("Couldn't rename the conversation. Please try again.");
      throw error;
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
    conversationToRename,
    renameConversation,
    renamePending: updateTitle.isPending,
    requestRenameConversation: (id: string, title: string) =>
      setConversationToRename({ id, title }),
    setConversationToRename,
    requestDeleteConversation: setConversationToDelete,
    setConversationToDelete,
  };
}
