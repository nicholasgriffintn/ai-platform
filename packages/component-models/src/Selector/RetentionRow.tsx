import { cn } from "@ngriffin_uk/polychat-component-ui";
import type { ConversationRetention, RetentionReason } from "@ngriffin_uk/polychat-schemas";

export interface RetentionRowProps {
  retention: ConversationRetention;
  reason: RetentionReason;
  onChange: (next: ConversationRetention) => void;
  isLocked?: boolean;
}

function getReasonDescription(reason: RetentionReason, retention: ConversationRetention) {
  switch (reason) {
    case "signed_out":
      return "Sign in to keep conversations on Polychat.";
    case "plan":
      return "Stored history is available to Pro users.";
    case "default":
      return "Temporary chats are your current default.";
    case "device_default":
      return retention === "kept"
        ? "This device-run chat can continue on another device."
        : "This device-run chat stays only on this device.";
    default:
      return retention === "kept"
        ? "Keep this conversation available on Polychat."
        : "Nothing in this conversation is kept on Polychat.";
  }
}

export function RetentionRow({ retention, reason, onChange, isLocked = false }: RetentionRowProps) {
  const isKept = retention === "kept";

  return (
    <div className="flex items-center gap-3 border-t border-border px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-foreground">Keep this chat</p>
        <p className="text-xs text-muted-foreground">
          {isKept ? "Stored on Polychat" : "Only on this device"}
        </p>
        <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
          {getReasonDescription(reason, retention)}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={isKept}
        aria-label="Keep this chat"
        disabled={isLocked}
        onClick={() => onChange(isKept ? "temporary" : "kept")}
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
          isKept ? "bg-active-work" : "bg-border-strong",
        )}
      >
        <span
          className={cn(
            "absolute top-1 h-3 w-3 rounded-full bg-surface transition-transform",
            isKept ? "left-5" : "left-1",
          )}
          aria-hidden="true"
        />
      </button>
    </div>
  );
}
