import { Button } from "@ngriffin_uk/polychat-component-ui";
import type { QueuedChatMessage } from "@ngriffin_uk/polychat-schemas";
import { Clock, Paperclip, X } from "lucide-react";

interface QueuedFollowUpsProps {
  messages: readonly QueuedChatMessage[];
  onRemove: (queuedId: string) => void;
}

export function QueuedFollowUps({ messages, onRemove }: QueuedFollowUpsProps) {
  if (messages.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="Queued messages"
      className="mb-2 space-y-1.5 rounded-lg border border-border bg-surface px-3 py-2"
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Clock className="size-3.5" aria-hidden="true" />
        <span>
          {messages.length === 1
            ? "1 message waiting its turn"
            : `${messages.length} messages waiting their turn`}
        </span>
      </div>
      <ol className="space-y-1">
        {messages.map((message) => (
          <li key={message.id} className="flex min-w-0 items-center gap-2 text-sm">
            <span className="min-w-0 flex-1 truncate" title={message.preview}>
              {message.preview || "Attachment only"}
            </span>
            {message.attachmentCount > 0 ? (
              <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                <Paperclip className="size-3" aria-hidden="true" />
                {message.attachmentCount}
              </span>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 w-6 shrink-0 p-0"
              aria-label="Remove queued message"
              title="Remove queued message"
              onClick={() => onRemove(message.id)}
            >
              <X className="size-3.5" aria-hidden="true" />
            </Button>
          </li>
        ))}
      </ol>
    </section>
  );
}
