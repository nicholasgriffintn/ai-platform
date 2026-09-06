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
    <div className="border-border mt-2 border-t px-2 pt-4">
      <div className="flex items-center justify-between px-2 pb-1.5">
        <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase">
          Recent
        </p>
        {controls}
      </div>
      {isLoading ? (
        <div className="p-4 text-center text-muted-foreground">Loading conversations...</div>
      ) : hasError ? (
        <div className="p-4 text-center text-muted-foreground">
          <p>Could not load items.</p>
          <Button type="button" variant="secondary" className="mt-2" onClick={onRetry}>
            Retry
          </Button>
        </div>
      ) : isEmpty ? (
        <div className="p-4 text-center text-muted-foreground">No conversations yet.</div>
      ) : (
        children
      )}
    </div>
  );
}
