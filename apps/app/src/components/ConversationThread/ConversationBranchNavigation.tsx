import { ConversationBranchesButton } from "@ngriffin_uk/polychat-component-conversation";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useChat } from "~/hooks/useChat";
import { getConversationBranches } from "~/lib/api/conversation-branches";
import { useChatStore } from "~/state/stores/chatStore";

export function ConversationBranchNavigation() {
  const { currentConversationId, isAuthenticated, setCurrentConversationId } = useChatStore();
  const conversation = useChat(currentConversationId);
  const [open, setOpen] = useState(false);
  const enabled = Boolean(
    isAuthenticated && currentConversationId && conversation.data && !conversation.data.isLocalOnly,
  );
  const query = useQuery({
    queryKey: ["conversation-branches", currentConversationId],
    queryFn: () => getConversationBranches(currentConversationId ?? ""),
    enabled: enabled && open,
    staleTime: 0,
  });

  if (!enabled || !currentConversationId) {
    return null;
  }

  return (
    <ConversationBranchesButton
      open={open}
      onOpenChange={setOpen}
      currentId={currentConversationId}
      data={query.data}
      isLoading={query.isFetching}
      errorMessage={query.error?.message}
      onRetry={() => {
        void query.refetch();
      }}
      onSelect={(id) => {
        setOpen(false);
        setCurrentConversationId(id);
      }}
    />
  );
}
