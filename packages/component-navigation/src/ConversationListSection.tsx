import { Button } from "@ngriffin_uk/polychat-component-ui";
import type { ReactNode } from "react";

export interface ConversationListSectionProps {
  controls?: ReactNode;
  isLoading?: boolean;
  hasError?: boolean;
  onRetry?: () => void;
  isEmpty?: boolean;
  children?: ReactNode;
}

export function ConversationListSection({
  controls,
  isLoading = false,
  hasError = false,
  onRetry,
  isEmpty = false,
  children,
}: ConversationListSectionProps) {
  return (
    <div className="px-2">
      <div className="flex items-center justify-between px-2 pb-2">
        <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          Recent conversations
        </p>
        {controls}
      </div>
      {isLoading ? (
        <div className="p-4 text-center text-zinc-500 dark:text-zinc-400">
          Loading conversations...
        </div>
      ) : hasError ? (
        <div className="p-4 text-center text-zinc-500 dark:text-zinc-400">
          <p>Could not load conversations.</p>
          <Button type="button" variant="secondary" className="mt-2" onClick={onRetry}>
            Retry
          </Button>
        </div>
      ) : isEmpty ? (
        <div className="p-4 text-center text-zinc-500 dark:text-zinc-400">
          No conversations yet.
        </div>
      ) : (
        children
      )}
    </div>
  );
}
