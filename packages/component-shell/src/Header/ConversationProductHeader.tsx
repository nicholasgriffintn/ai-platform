import {
  AgentTraceButton,
  ContextDetailsButton,
  ConversationTitleContext,
} from "@ngriffin_uk/polychat-component-conversation";
import { buildAgentTraceEntries } from "@ngriffin_uk/polychat-library-chat/agent-trace";
import type { ChatRequestOptions } from "@ngriffin_uk/polychat-library-chat/conversation-types";
import { API_BASE_URL, useChatStore } from "@ngriffin_uk/polychat-library-client";
import { useChat, useConversationStorage } from "@ngriffin_uk/polychat-library-react";
import { Ghost } from "lucide-react";
import { useMemo } from "react";

import { ConversationRetentionControl } from "./ConversationRetentionControl.js";
import { ConversationShareButton } from "./ConversationShareButton.js";
import { ConversationThreadNavigation } from "./ConversationThreadNavigation.js";
import { ProductModeHeader } from "./ProductModeHeader.js";

export interface ConversationProductHeaderProps {
  projectColour?: string;
  requestOptions?: ChatRequestOptions;
}

export function ConversationProductHeader({
  projectColour,
  requestOptions,
}: ConversationProductHeaderProps) {
  const { currentConversationId, isAuthenticated, isPro, setCurrentConversationId } =
    useChatStore();
  const { data: conversation, isLoading } = useChat(currentConversationId);
  const conversationProjectId = conversation?.project_id;
  const storageRequestOptions = useMemo(
    () => (conversationProjectId ? { metadata: { project_id: conversationProjectId } } : undefined),
    [conversationProjectId],
  );
  const storageModeOptions = requestOptions?.metadata?.project_id
    ? requestOptions
    : storageRequestOptions;
  const { determineStorageMode } = useConversationStorage(storageModeOptions);
  const storageMode = determineStorageMode(currentConversationId);
  const traceEntries = useMemo(
    () => buildAgentTraceEntries(conversation?.messages ?? []),
    [conversation?.messages],
  );
  const title =
    currentConversationId && isLoading
      ? "Loading conversation…"
      : (conversation?.title ?? "New conversation");

  return (
    <ProductModeHeader
      projectColour={projectColour}
      context={
        <div className="flex min-w-0 items-center gap-2">
          {storageMode.retention === "temporary" ? (
            <Ghost
              size={16}
              className="shrink-0 text-muted-foreground"
              aria-label="Temporary conversation"
            />
          ) : null}
          <ConversationTitleContext
            title={title}
            parentConversationId={conversation?.parent_conversation_id}
            onOpenParent={setCurrentConversationId}
          />
        </div>
      }
      actions={
        <div className="flex shrink-0 items-center gap-0.5">
          <ConversationThreadNavigation />
          {conversation?.latest_run?.context || conversation?.latest_run?.usage ? (
            <ContextDetailsButton
              context={conversation.latest_run.context}
              usage={conversation.latest_run.usage}
              compactOnMobile
              resolveReferenceHref={(path) => `${API_BASE_URL}${path}`}
            />
          ) : null}
          <AgentTraceButton entries={traceEntries} compactOnMobile />
          {conversation?.isLocalOnly &&
            !conversation.project_id &&
            !isLoading &&
            currentConversationId &&
            isAuthenticated &&
            isPro && <ConversationRetentionControl conversationId={currentConversationId} />}
          {!conversation?.isLocalOnly &&
            !conversation?.project_id &&
            !isLoading &&
            currentConversationId &&
            isAuthenticated && (
              <ConversationShareButton
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
