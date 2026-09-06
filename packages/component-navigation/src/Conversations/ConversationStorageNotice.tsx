export interface ConversationStorageNoticeProps {
  isAuthenticated: boolean;
  isPro: boolean;
  localOnlyMode: boolean;
}

export function ConversationStorageNotice({
  isAuthenticated,
  isPro,
  localOnlyMode,
}: ConversationStorageNoticeProps) {
  return (
    <div className="mb-2">
      {!isAuthenticated && (
        <div className="border-y border-sidebar-border bg-surface-elevated px-3 py-2 text-xs text-muted-foreground">
          Chats are only stored on this device while you are not signed in
        </div>
      )}

      {!isPro && isAuthenticated && (
        <div className="border-y border-sidebar-border bg-surface-elevated px-3 py-2 text-xs text-muted-foreground">
          {localOnlyMode
            ? "Local-only mode: Chats are only stored on this device"
            : "Free plan: Chats are only stored on this device"}
        </div>
      )}

      {isPro && isAuthenticated && localOnlyMode && (
        <div className="border-y border-sidebar-border bg-surface-elevated px-3 py-2 text-xs text-muted-foreground">
          Local-only mode: Chats are only stored on this device
        </div>
      )}
    </div>
  );
}
