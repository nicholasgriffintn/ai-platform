import { ConversationBranchesButton } from "@ngriffin_uk/polychat-component-conversation";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useChat } from "~/hooks/useChat";
import { getConversationBranches } from "~/lib/api/conversation-branches";
import { useChatStore } from "~/state/stores/chatStore";

function BranchPicker({
  conversationId,
  userId,
  onSelect,
}: {
  conversationId: string;
  userId?: number;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const query = useQuery({
    queryKey: ["conversation-branches", userId, conversationId],
    queryFn: () => getConversationBranches(conversationId),
    enabled: open,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  return (
    <ConversationBranchesButton
      open={open}
      onOpenChange={setOpen}
      currentId={conversationId}
      data={query.data}
      isLoading={query.isFetching && !query.data}
      errorMessage={query.error?.message}
      onRetry={() => {
        void query.refetch();
      }}
      onSelect={(id) => {
        setOpen(false);
        onSelect(id);
      }}
    />
  );
}

export function ConversationBranchNavigation() {
  const { currentConversationId, isAuthenticated, user, setCurrentConversationId } = useChatStore();
  const { data: conversation } = useChat(currentConversationId);

  if (
    !isAuthenticated ||
    !currentConversationId ||
    !conversation?.has_branches ||
    conversation.isLocalOnly
  ) {
    return null;
  }

  return (
    <BranchPicker
      key={`${user?.id}:${currentConversationId}`}
      conversationId={currentConversationId}
      userId={user?.id}
      onSelect={setCurrentConversationId}
    />
  );
}
