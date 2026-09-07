import { ListItem } from "@ngriffin_uk/polychat-component-ui";
import type { ConversationSection, ConversationSummary } from "@ngriffin_uk/polychat-utility-react";
import { CircleQuestionMark, Ghost, GitBranch, LoaderCircle, Mail, Pin } from "lucide-react";
import type { ReactNode, Ref } from "react";

export type { ConversationSection, ConversationSummary } from "@ngriffin_uk/polychat-utility-react";

export interface ConversationListProps {
  sections: ConversationSection[];
  activeConversationId?: string;
  isConversationRoute: boolean;
  loadMoreRef?: Ref<HTMLDivElement>;
  loadMoreSlot?: ReactNode;
  onSelect: (conversationId: string | undefined) => void;
  renderItemActions?: (conversation: ConversationSummary & { id: string }) => ReactNode;
}

export function ConversationList({
  sections,
  activeConversationId,
  isConversationRoute,
  loadMoreRef,
  loadMoreSlot,
  onSelect,
  renderItemActions,
}: ConversationListProps) {
  return (
    <>
      {sections.map(({ id, title, conversations }) =>
        conversations.length === 0 ? null : (
          <div key={id}>
            {title && (
              <h3 className="px-2 py-1 text-xs font-semibold tracking-wider text-muted-foreground">
                {title}
              </h3>
            )}
            <ul className="mb-3 space-y-1">
              {conversations.map((conversation) => (
                <ListItem
                  key={conversation.id}
                  data-id={conversation.id}
                  isActive={isConversationRoute && activeConversationId === conversation.id}
                  badge={
                    <span className="inline-flex items-center gap-1">
                      {conversation.isStreaming && (
                        <LoaderCircle
                          size={16}
                          className="animate-spin text-active-work"
                          aria-label="Response in progress"
                        />
                      )}
                      {conversation.needsInput && (
                        <CircleQuestionMark
                          size={16}
                          className="text-attention"
                          aria-label="Action required"
                        />
                      )}
                      {conversation.isPinned && (
                        <Pin size={14} className="text-active-work" aria-label="Pinned" />
                      )}
                      {conversation.isUnread && (
                        <Mail size={14} className="text-attention" aria-label="Unread" />
                      )}
                      {conversation.isLocalOnly && (
                        <span className="inline-flex items-center text-xs text-muted-foreground">
                          <Ghost size={14} aria-label="Temporary conversation" />
                        </span>
                      )}
                      {conversation.parentConversationId && (
                        <button
                          type="button"
                          className="inline-flex cursor-pointer items-center text-xs text-muted-foreground hover:text-foreground"
                          title="Go to original conversation"
                          aria-label="Go to original conversation"
                          onClick={(event) => {
                            event?.stopPropagation();
                            onSelect(conversation.parentConversationId ?? undefined);
                          }}
                        >
                          <GitBranch size={14} />
                        </button>
                      )}
                    </span>
                  }
                  label={
                    <span data-dynamic-copy="">{conversation.title || "New conversation"}</span>
                  }
                  onClick={() => onSelect(conversation.id)}
                  actionsWidth="compact"
                  actions={
                    conversation.id && renderItemActions
                      ? renderItemActions({ ...conversation, id: conversation.id })
                      : undefined
                  }
                />
              ))}
            </ul>
          </div>
        ),
      )}
      {loadMoreRef && (
        <div ref={loadMoreRef} className="h-8">
          {loadMoreSlot}
        </div>
      )}
    </>
  );
}
