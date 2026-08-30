import type { ReactNode } from "react";

import { Button } from "./Button";
import { cn } from "./utils";

export interface PetBubbleProps {
  children: ReactNode;
  placement?: "left" | "top";
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
  className?: string;
}

const PLACEMENT_CLASSES: Record<"left" | "top", string> = {
  left: "right-full mr-2 bottom-1 origin-bottom-right",
  top: "bottom-full mb-2 left-1/2 -translate-x-1/2 origin-bottom",
};

export function PetBubble({
  children,
  placement = "left",
  actionLabel,
  onAction,
  onDismiss,
  className,
}: PetBubbleProps) {
  return (
    <div
      className={cn(
        "absolute z-20 w-max max-w-56 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-left text-xs leading-snug text-zinc-700 shadow-md",
        "animate-in fade-in-0 zoom-in-95 duration-150 motion-reduce:animate-none",
        "dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200",
        PLACEMENT_CLASSES[placement],
        className,
      )}
    >
      <p className="m-0">{children}</p>
      {actionLabel || onDismiss ? (
        <div className="mt-1.5 flex items-center gap-1.5">
          {actionLabel && onAction ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 px-2"
              onClick={onAction}
            >
              {actionLabel}
            </Button>
          ) : null}
          {onDismiss ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2"
              onClick={onDismiss}
            >
              Dismiss
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
