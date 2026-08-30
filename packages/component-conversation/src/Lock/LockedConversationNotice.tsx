import { Button } from "@ngriffin_uk/polychat-component-ui";
import { LockIcon } from "lucide-react";

export interface LockedConversationNoticeProps {
  onUnlock: () => void;
  isUnlocking?: boolean;
}

export function LockedConversationNotice({
  onUnlock,
  isUnlocking = false,
}: LockedConversationNoticeProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <LockIcon className="size-8 text-zinc-900 dark:text-zinc-100" aria-hidden="true" />
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          This chat is locked
        </h2>
        <p className="max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
          Unlock it with your passkey, your password, or your recovery key. Polychat does not keep a
          copy of any of them.
        </p>
      </div>
      <Button type="button" variant="primary" onClick={onUnlock} isLoading={isUnlocking}>
        Unlock
      </Button>
    </div>
  );
}
