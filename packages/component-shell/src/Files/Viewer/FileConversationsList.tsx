import { ListItem } from "@ngriffin_uk/polychat-component-ui";
import { useSubjectConversations } from "@ngriffin_uk/polychat-library-react";
import type { ConversationSubject } from "@ngriffin_uk/polychat-schemas";
import { formatRelativeTime } from "@ngriffin_uk/polychat-utility-core";

export function FileConversationsList({
  subject,
  onResume,
}: {
  subject: ConversationSubject;
  onResume: (conversationId: string) => void;
}) {
  const conversations = useSubjectConversations(subject);
  const items = conversations.data ?? [];

  return (
    <div className="flex flex-col gap-3">
      {conversations.isLoading ? (
        <p className="text-sm text-muted-foreground">Finding earlier conversations…</p>
      ) : conversations.error ? (
        <p role="alert" className="text-sm text-failure">
          {conversations.error.message}
        </p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing asked about this file yet. Ask below and the conversation stays with it.
        </p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {items.map((conversation) => (
            <ListItem
              key={conversation.id}
              data-id={conversation.id}
              label={conversation.title || "Untitled conversation"}
              sublabel={
                conversation.updated_at ? formatRelativeTime(conversation.updated_at) : undefined
              }
              onClick={() => onResume(conversation.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
