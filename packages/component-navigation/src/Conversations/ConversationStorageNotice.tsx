import type { RetentionReason } from "@ngriffin_uk/polychat-library-chat/conversation-storage-policy";

export interface ConversationStorageNoticeProps {
  reason: RetentionReason | null;
}

const NOTICE_COPY: Record<RetentionReason, string> = {
  chosen: "Temporary. Nothing here is kept.",
  default: "Temporary by default. Change this in Settings.",
  signed_out: "Not signed in, so this stays on this device.",
  plan: "Stored history is part of Pro. This stays on this device.",
  device_default: "Answered on this machine. The transcript is still saved to Polychat.",
};

export function ConversationStorageNotice({ reason }: ConversationStorageNoticeProps) {
  if (!reason) {
    return null;
  }

  return (
    <div className="mb-2">
      <div className="border-y border-sidebar-border bg-surface-elevated px-3 py-2 text-xs text-muted-foreground">
        {NOTICE_COPY[reason]}
      </div>
    </div>
  );
}
