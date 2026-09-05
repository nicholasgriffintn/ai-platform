import type { ReactNode } from "react";
import { useId } from "react";

import { useDelayedHover } from "./useDelayedHover";
import { cn } from "./utils";

export interface ShortcutTooltipProps {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  keys: string[];
  label: string;
}

export function ShortcutTooltip({
  children,
  className,
  disabled = false,
  keys,
  label,
}: ShortcutTooltipProps) {
  const tooltipId = useId();
  const { isVisible, ...hoverProps } = useDelayedHover({ delayMs: 500, disabled });

  return (
    <span className={cn("relative inline-flex", className)} {...hoverProps}>
      <span aria-describedby={disabled ? undefined : tooltipId} className="inline-flex">
        {children}
      </span>
      {!disabled ? (
        <span
          id={tooltipId}
          role="tooltip"
          className={cn(
            "border-border bg-popover text-popover-foreground polychat-motion-micro pointer-events-none absolute right-0 bottom-full z-[80] mb-2 flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap shadow-[var(--polychat-elevated-shadow)] transition",
            isVisible ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
          )}
        >
          <span>{label}</span>
          <span className="flex items-center gap-1" aria-hidden="true">
            {keys.map((key) =>
              key === "or" ? (
                <span key={key} className="text-muted-foreground text-[10px]">
                  or
                </span>
              ) : (
                <kbd
                  key={key}
                  className="bg-selection text-foreground border-border min-w-5 rounded border px-1 py-0.5 text-center text-[10px]"
                >
                  {key}
                </kbd>
              ),
            )}
          </span>
        </span>
      ) : null}
    </span>
  );
}
