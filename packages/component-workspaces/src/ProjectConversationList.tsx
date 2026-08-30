import { ButtonLink, Card, EmptyState, Link } from "@ngriffin_uk/polychat-component-ui";
import { ArrowRight, MessageSquareText } from "lucide-react";

export interface ProjectConversationSummary {
  id: string;
  title?: string | null;
  messageCount: number;
  createdByName?: string | null;
  href: string;
}

export interface ProjectConversationListProps {
  conversations: ProjectConversationSummary[];
  conversationCount: number;
  newConversationHref: string;
}

export function ProjectConversationList({
  conversations,
  conversationCount,
  newConversationHref,
}: ProjectConversationListProps) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          Recent conversations
        </h2>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {conversationCount} conversations
        </span>
      </div>
      {conversations.length === 0 ? (
        <EmptyState
          icon={<MessageSquareText className="text-zinc-400" size={24} />}
          title="No conversations yet"
          message="Start a project conversation to use its instructions and capabilities."
          action={
            <ButtonLink variant="primary" href={newConversationHref}>
              New conversation
            </ButtonLink>
          }
          className="min-h-[220px]"
        />
      ) : (
        <div className="space-y-2">
          {conversations.map((conversation) => (
            <Link
              key={conversation.id}
              href={conversation.href}
              className="group block no-underline hover:!no-underline"
            >
              <Card className="flex-row items-center gap-4 p-4 py-4 shadow-none group-hover:border-zinc-400 dark:group-hover:border-zinc-600">
                <MessageSquareText size={18} className="text-zinc-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-950 group-hover:underline dark:text-white">
                    {conversation.title || "New project conversation"}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {conversation.createdByName || "Workspace member"} · {conversation.messageCount}{" "}
                    message
                    {conversation.messageCount !== 1 ? "s" : ""}
                  </p>
                </div>
                <ArrowRight size={16} className="text-zinc-400" />
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
