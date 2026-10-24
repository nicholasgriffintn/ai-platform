import { Button, OptionsMenu, OptionsMenuAction } from "@ngriffin_uk/polychat-component-ui";
import type { NotebookDetail } from "@ngriffin_uk/polychat-schemas";
import { formatRelativeTime } from "@ngriffin_uk/polychat-utility-core";
import { MessagesSquare, Settings2, SquarePen } from "lucide-react";

import { PageShell } from "../Shell/PageShell.js";

export function NotebookHeader({ notebook }: { notebook: NotebookDetail }) {
  return (
    <PageShell.Header
      title={notebook.name}
      actionContent={
        <p className="hidden truncate text-xs text-muted-foreground tabular-nums sm:block">
          {notebook.sources.length === 1 ? "1 source" : `${notebook.sources.length} sources`}
          {" · "}
          {notebook.conversations.length === 1
            ? "1 chat"
            : `${notebook.conversations.length} chats`}
          {" · "}
          Started {formatRelativeTime(notebook.createdAt)}
        </p>
      }
    />
  );
}

export function NotebookChatActions({
  notebook,
  conversationId,
  onSelectConversation,
  onOpenSettings,
}: {
  notebook: NotebookDetail;
  conversationId?: string;
  onSelectConversation: (conversationId: string | undefined) => void;
  onOpenSettings: () => void;
}) {
  const current = notebook.conversations.find((conversation) => conversation.id === conversationId);

  return (
    <>
      <OptionsMenu
        align="end"
        className="max-h-80 w-64 overflow-y-auto"
        trigger={
          <Button variant="ghost" size="sm" aria-label="Chats in this notebook">
            <span className="flex max-w-48 items-center gap-2 truncate">
              <MessagesSquare className="size-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{current?.title ?? "New chat"}</span>
            </span>
          </Button>
        }
      >
        <OptionsMenuAction onSelect={() => onSelectConversation(undefined)}>
          <SquarePen className="mr-2 size-4 shrink-0" aria-hidden="true" />
          New chat
        </OptionsMenuAction>
        {notebook.conversations.map((conversation) => (
          <OptionsMenuAction
            key={conversation.id}
            onSelect={() => onSelectConversation(conversation.id)}
          >
            <span className="truncate">{conversation.title || "New conversation"}</span>
          </OptionsMenuAction>
        ))}
      </OptionsMenu>
      {notebook.canManage ? (
        <Button
          variant="icon"
          aria-label="Configure chat"
          title="Configure chat"
          onClick={onOpenSettings}
        >
          <Settings2 className="size-4" />
        </Button>
      ) : null}
    </>
  );
}
