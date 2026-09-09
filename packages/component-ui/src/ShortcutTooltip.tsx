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
    <span className={cn("relative inline-flex max-w-full", className)} {...hoverProps}>
      <span
        aria-describedby={disabled ? undefined : tooltipId}
        className="inline-flex max-w-full min-w-0"
      >
        {children}
      </span>
      {!disabled ? (
        <span
          id={tooltipId}
          role="tooltip"
          className={cn(
            "polychat-motion-micro pointer-events-none absolute right-0 bottom-full z-[80] mb-2 flex items-center gap-2 rounded-full border border-border bg-popover px-3 py-1.5 text-xs font-medium whitespace-nowrap text-popover-foreground shadow-[var(--polychat-elevated-shadow)] transition",
            isVisible ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
          )}
        >
          <span>{label}</span>
          <span className="flex items-center gap-1" aria-hidden="true">
            {keys.map((key) =>
              key === "or" ? (
                <span key={key} className="text-[10px] text-muted-foreground">
                  or
                </span>
              ) : (
                <kbd
                  key={key}
                  className="min-w-5 rounded border border-border bg-selection px-1 py-0.5 text-center text-[10px] text-foreground"
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
