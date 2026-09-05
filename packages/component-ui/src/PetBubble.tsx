import { XIcon } from "lucide-react";
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
        "border-border bg-surface-elevated text-foreground absolute z-20 w-max max-w-56 rounded-lg border px-2.5 py-1.5 text-left text-xs leading-snug shadow-[var(--polychat-elevated-shadow)]",
        "animate-in fade-in-0 zoom-in-95 duration-150 motion-reduce:animate-none",
        PLACEMENT_CLASSES[placement],
        className,
      )}
    >
      {onDismiss ? (
        <Button
          type="button"
          variant="icon"
          size="xs"
          className="absolute top-1 left-1 h-5 min-h-0 w-5 min-w-0 p-0"
          onClick={onDismiss}
          aria-label="Dismiss"
        >
          <XIcon className="size-3.5" aria-hidden="true" />
        </Button>
      ) : null}
      <p className={cn("m-0", onDismiss && "pl-5")}>{children}</p>
      {actionLabel && onAction ? (
        <div className="mt-1.5 flex items-center gap-1.5">
          <Button type="button" variant="outline" size="sm" className="h-6 px-2" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
