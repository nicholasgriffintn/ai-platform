import {
  AgentTraceButton,
  ConversationTitleContext,
} from "@ngriffin_uk/polychat-component-conversation";
import { buildAgentTraceEntries } from "@ngriffin_uk/polychat-library-chat/agent-trace";
import { useMemo } from "react";

import { ProductModeHeader } from "~/components/Core/ProductModeHeader";
import { useChat } from "~/hooks/useChat";
import { isConversationLocked } from "~/hooks/useConversationLock";
import { useChatStore } from "~/state/stores/chatStore";

import { ConversationLockControls } from "./ConversationLockControls";
import { ShareButton } from "./ShareButton";

interface ConversationProductHeaderProps {
  showCloudToggle?: boolean;
}

export function ConversationProductHeader({
  showCloudToggle = false,
}: ConversationProductHeaderProps) {
  const { currentConversationId, isAuthenticated, setCurrentConversationId } = useChatStore();
  const { data: conversation, isLoading } = useChat(currentConversationId);
  const traceEntries = useMemo(
    () => buildAgentTraceEntries(conversation?.messages ?? []),
    [conversation?.messages],
  );
  const isLocked = isConversationLocked(conversation);
  const title =
    currentConversationId && isLoading
      ? "Loading conversation…"
      : (conversation?.title ?? "New conversation");

  return (
    <ProductModeHeader
      showCloudToggle={showCloudToggle}
      context={
        <ConversationTitleContext
          title={title}
          parentConversationId={conversation?.parent_conversation_id}
          onOpenParent={setCurrentConversationId}
        />
      }
      actions={
        <div className="flex shrink-0 items-center gap-0.5">
          <AgentTraceButton entries={traceEntries} compactOnMobile />
          {!isLoading && currentConversationId && isAuthenticated && (
            <ConversationLockControls conversationId={currentConversationId} />
          )}
          {!conversation?.isLocalOnly &&
            !conversation?.project_id &&
            !isLocked &&
            !isLoading &&
            currentConversationId &&
            isAuthenticated && (
              <ShareButton
                conversationId={currentConversationId}
                isPublic={conversation?.is_public}
                shareId={conversation?.share_id}
                className="shrink-0"
                compactOnMobile
              />
            )}
        </div>
      }
    />
  );
}
