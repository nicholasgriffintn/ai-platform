import { ProductHeaderShell } from "@ngriffin_uk/polychat-component-navigation";
import { Button } from "@ngriffin_uk/polychat-component-ui";
import { buildAgentTraceEntries } from "@ngriffin_uk/polychat-library-chat/agent-trace";
import { API_BASE_URL, useChatStore } from "@ngriffin_uk/polychat-library-client";
import { useChat } from "@ngriffin_uk/polychat-library-react";
import { SquarePen } from "lucide-react";
import { type ReactNode, useMemo } from "react";

import { AgentTraceButton } from "../AgentTracePanel";
import { ContextDetailsButton } from "../ContextDetailsPanel";
import { ConversationTitleContext } from "../ConversationTitleContext";

export interface ConversationHeaderProps {
  /** Rendered before the built-in actions, for host-specific controls. */
  actions?: ReactNode;
}

export function ConversationHeader({ actions }: ConversationHeaderProps) {
  const currentConversationId = useChatStore((state) => state.currentConversationId);
  const setCurrentConversationId = useChatStore((state) => state.setCurrentConversationId);
  const { data: conversation, isLoading } = useChat(currentConversationId);
  const traceEntries = useMemo(
    () => buildAgentTraceEntries(conversation?.messages ?? []),
    [conversation?.messages],
  );
  const title =
    currentConversationId && isLoading
      ? "Loading conversation…"
      : (conversation?.title ?? "New conversation");

  return (
    <ProductHeaderShell
      start={
        <ConversationTitleContext
          title={title}
          parentConversationId={conversation?.parent_conversation_id}
          onOpenParent={setCurrentConversationId}
        />
      }
      end={
        <div className="flex shrink-0 items-center gap-0.5">
          {actions}
          {conversation?.latest_run?.context || conversation?.latest_run?.usage ? (
            <ContextDetailsButton
              context={conversation.latest_run.context}
              usage={conversation.latest_run.usage}
              compactOnMobile
              resolveReferenceHref={(path) => `${API_BASE_URL}${path}`}
            />
          ) : null}
          <AgentTraceButton entries={traceEntries} compactOnMobile />
          <Button
            variant="icon"
            className="h-8 w-8 shrink-0 p-1.5"
            title="New conversation"
            aria-label="New conversation"
            icon={<SquarePen className="h-4 w-4" />}
            onClick={() => setCurrentConversationId(undefined)}
          />
        </div>
      }
    />
  );
}
