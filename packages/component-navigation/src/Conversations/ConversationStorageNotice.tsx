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
        <div className="bg-surface-elevated text-muted-foreground border-sidebar-border border-y px-3 py-2 text-xs">
          Chats are only stored on this device while you are not signed in
        </div>
      )}

      {!isPro && isAuthenticated && (
        <div className="bg-surface-elevated text-muted-foreground border-sidebar-border border-y px-3 py-2 text-xs">
          {localOnlyMode
            ? "Local-only mode: Chats are only stored on this device"
            : "Free plan: Chats are only stored on this device"}
        </div>
      )}

      {isPro && isAuthenticated && localOnlyMode && (
        <div className="bg-surface-elevated text-muted-foreground border-sidebar-border border-y px-3 py-2 text-xs">
          Local-only mode: Chats are only stored on this device
        </div>
      )}
    </div>
  );
}
