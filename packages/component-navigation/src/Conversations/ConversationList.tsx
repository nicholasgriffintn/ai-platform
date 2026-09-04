import { HoverActions, ListItem } from "@ngriffin_uk/polychat-component-ui";
import { CircleQuestionMark, CloudOff, Edit, GitBranch, LoaderCircle, Trash2 } from "lucide-react";
import type { Ref } from "react";

export interface ConversationSummary {
  id?: string;
  title?: string | null;
  isLocalOnly?: boolean;
  parentConversationId?: string | null;
  needsInput?: boolean;
  isStreaming?: boolean;
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
}: ConversationListProps) {
  return (
    <>
      {groups.map(({ id, title, conversations }) =>
        conversations.length === 0 ? null : (
          <div key={id}>
            {title && (
              <h3 className="px-2 py-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400 tracking-wider">
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
                          className="animate-spin text-blue-500"
                          aria-label="Response in progress"
                        />
                      )}
                      {conversation.needsInput && (
                        <CircleQuestionMark
                          size={16}
                          className="text-amber-500"
                          aria-label="Action required"
                        />
                      )}
                      {(conversation.isLocalOnly || localOnlyMode) && (
                        <span className="text-xs text-blue-500 dark:text-blue-400 inline-flex items-center">
                          <CloudOff size={14} />
                          <span className="sr-only">Local only</span>
                        </span>
                      )}
                      {conversation.parentConversationId && (
                        <button
                          type="button"
                          className="text-xs text-zinc-600 dark:text-zinc-400 inline-flex items-center cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100"
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
                  actions={
                    conversation.id ? (
                      <HoverActions
                        actions={[
                          {
                            id: "edit",
                            icon: <Edit size={14} />,
                            label: "Edit conversation title",
                            onClick: (event) => {
                              event.stopPropagation();
                              onEditTitle(conversation.id || "", conversation.title || "");
                            },
                          },
                          {
                            id: "delete",
                            icon: <Trash2 size={14} />,
                            label: "Delete",
                            onClick: (event) => {
                              event.stopPropagation();
                              onDelete(conversation.id || "");
                            },
                          },
                        ]}
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
