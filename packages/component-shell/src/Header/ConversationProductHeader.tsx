import {
  ConversationContextSummaryButton,
  ConversationTitleContext,
} from "@ngriffin_uk/polychat-component-conversation";
import { buildAgentTraceEntries } from "@ngriffin_uk/polychat-library-chat/agent-trace";
import type { ChatRequestOptions } from "@ngriffin_uk/polychat-library-chat/conversation-types";
import { API_BASE_URL, useChatStore } from "@ngriffin_uk/polychat-library-client";
import { useChat } from "@ngriffin_uk/polychat-library-react";
import { useMemo, type ReactNode } from "react";

import { ConversationRetentionControl } from "./ConversationRetentionControl.js";
import { ConversationShareButton } from "./ConversationShareButton.js";
import { ConversationThreadNavigation } from "./ConversationThreadNavigation.js";
import { ProductModeHeader } from "./ProductModeHeader.js";

export interface ConversationProductHeaderProps {
  additionalActions?: ReactNode;
  projectColour?: string;
  requestOptions?: ChatRequestOptions;
  showProductModeSwitch?: boolean;
  status?: ReactNode;
}

export function ConversationProductHeader({
  additionalActions,
  projectColour,
  requestOptions,
  showProductModeSwitch,
  status,
}: ConversationProductHeaderProps) {
  const { currentConversationId, isAuthenticated, setCurrentConversationId } = useChatStore();
  const { data: conversation, isLoading } = useChat(currentConversationId);
  const conversationProjectId = conversation?.project_id;
  const storageRequestOptions = useMemo(
    () => (conversationProjectId ? { metadata: { project_id: conversationProjectId } } : undefined),
    [conversationProjectId],
  );
  const storageModeOptions = requestOptions?.metadata?.project_id
    ? requestOptions
    : storageRequestOptions;
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
      showProductModeSwitch={showProductModeSwitch ?? !currentConversationId}
      context={
        <div className="flex min-w-0 items-center gap-2">
          <ConversationTitleContext
            title={title}
            parentConversationId={conversation?.parent_conversation_id}
            onOpenParent={setCurrentConversationId}
          />
          {status ? (
            <>
              <span aria-hidden="true" className="h-4 w-px shrink-0 bg-border" />
              <div className="min-w-0">{status}</div>
            </>
          ) : null}
        </div>
      }
      actions={
        <div className="flex shrink-0 items-center gap-0.5">
          <ConversationThreadNavigation />
          <ConversationContextSummaryButton
            context={conversation?.latest_run?.context}
            usage={conversation?.latest_run?.usage}
            entries={traceEntries}
            compactOnMobile
            resolveReferenceHref={(path) => `${API_BASE_URL}${path}`}
          />
          {!conversation?.project_id && !isLoading && (
            <ConversationRetentionControl
              conversationId={currentConversationId}
              isLocalOnly={Boolean(conversation?.isLocalOnly)}
              requestOptions={storageModeOptions}
            />
          )}
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
          {additionalActions}
        </div>
      }
    />
  );
}
