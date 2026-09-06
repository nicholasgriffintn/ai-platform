import { ConversationThreadsButton } from "@ngriffin_uk/polychat-component-conversation";
import { getConversationBranches, useChatStore } from "@ngriffin_uk/polychat-library-client";
import { useChat } from "@ngriffin_uk/polychat-library-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

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
    queryKey: ["conversation-threads", userId, conversationId],
    queryFn: () => getConversationBranches(conversationId),
    enabled: open,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  return (
    <ConversationThreadsButton
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

export function ConversationThreadNavigation() {
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
