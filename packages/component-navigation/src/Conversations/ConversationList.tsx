import { ListItem } from "@ngriffin_uk/polychat-component-ui";
import type { ConversationLabel } from "@ngriffin_uk/polychat-schemas";
import { CircleQuestionMark, CloudOff, GitBranch, LoaderCircle, Mail, Pin } from "lucide-react";
import type { Ref } from "react";

import { ConversationListItemActions } from "./ConversationListItemActions";

export interface ConversationSummary {
  id?: string;
  title?: string | null;
  isLocalOnly?: boolean;
  parentConversationId?: string | null;
  needsInput?: boolean;
  isStreaming?: boolean;
  isPinned?: boolean;
  isUnread?: boolean;
  labels?: ConversationLabel[];
}

export interface ConversationGroup {
  id: string;
  title?: string;
  conversations: ConversationSummary[];
}

export interface ConversationListProps {
  groups: ConversationGroup[];
  activeConversationId?: string;
  isConversationRoute: boolean;
  localOnlyMode?: boolean;
  loadMoreRef?: Ref<HTMLDivElement>;
  loadMoreSlot?: React.ReactNode;
  onSelect: (conversationId: string | undefined) => void;
  onEditTitle: (conversationId: string, currentTitle: string) => void;
  onDelete: (conversationId: string) => void;
  onOrganise?: (conversationId: string) => void;
}

export function ConversationList({
  groups,
  activeConversationId,
  isConversationRoute,
  localOnlyMode = false,
  loadMoreRef,
  loadMoreSlot,
  onSelect,
  onEditTitle,
  onDelete,
  onOrganise,
}: ConversationListProps) {
  return (
    <>
      {groups.map(({ id, title, conversations }) =>
        conversations.length === 0 ? null : (
          <div key={id}>
            {title && (
              <h3 className="text-muted-foreground px-2 py-1 text-xs font-semibold tracking-wider">
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
                          className="text-active-work animate-spin"
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
                      {conversation.labels?.[0] && (
                        <span className="bg-muted text-muted-foreground max-w-20 truncate rounded px-1.5 py-0.5 text-[10px]">
                          {conversation.labels[0].name}
                        </span>
                      )}
                      {(conversation.isLocalOnly || localOnlyMode) && (
                        <span className="text-active-work inline-flex items-center text-xs">
                          <CloudOff size={14} />
                          <span className="sr-only">Local only</span>
                        </span>
                      )}
                      {conversation.parentConversationId && (
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground inline-flex cursor-pointer items-center text-xs"
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
                    conversation.id ? (
                      <ConversationListItemActions
                        conversationId={conversation.id}
                        title={conversation.title || ""}
                        canOrganise={
                          Boolean(onOrganise) && !conversation.isLocalOnly && !localOnlyMode
                        }
                        onEditTitle={onEditTitle}
                        onDelete={onDelete}
                        onOrganise={onOrganise}
                      />
                    ) : undefined
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
