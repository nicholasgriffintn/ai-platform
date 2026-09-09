import { Card } from "@ngriffin_uk/polychat-component-ui";
import type { ConversationHandle } from "@ngriffin_uk/polychat-schemas";

interface ConversationHandleSettingsProps {
  handles: ConversationHandle[];
  isRevoking: boolean;
  hasError: boolean;
  onRevoke: (id: string) => void;
}

export function ConversationHandleSettings({
  handles,
  isRevoking,
  hasError,
  onRevoke,
}: ConversationHandleSettingsProps) {
  return (
    <Card className="gap-3 p-5">
      <div>
        <h3 className="font-semibold text-foreground">Conversation access</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Delegates can message only conversations with an active handle.
        </p>
      </div>
      {hasError && (
        <p role="alert" className="text-sm text-failure">
          Conversation access could not be updated. Try again.
        </p>
      )}
      {handles.length > 0 && (
        <ul className="space-y-2" aria-label="Active conversation handles">
          {handles.map((handle) => (
            <li
              key={handle.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border p-3"
            >
              <div className="min-w-0 text-sm">
                <div className="truncate font-medium text-foreground">{handle.conversationId}</div>
                <div className="text-xs text-muted-foreground">
                  Granted {handle.grantedBy === "user" ? "by you" : "when spawned"}
                </div>
              </div>
              <button
                type="button"
                className="shrink-0 text-xs text-failure"
                disabled={isRevoking}
                onClick={() => onRevoke(handle.id)}
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
