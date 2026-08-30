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
            "pointer-events-none absolute bottom-full right-0 z-[80] mb-2 flex items-center gap-2 whitespace-nowrap rounded-full border border-zinc-700/70 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-50 shadow-lg transition duration-150 dark:border-zinc-600 dark:bg-zinc-800",
            isVisible ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
          )}
        >
          <span>{label}</span>
          <span className="flex items-center gap-1" aria-hidden="true">
            {keys.map((key) =>
              key === "or" ? (
                <span key={key} className="text-[10px] text-zinc-400">
                  or
                </span>
              ) : (
                <kbd
                  key={key}
                  className="min-w-5 rounded bg-zinc-700 px-1 py-0.5 text-center text-[10px] text-zinc-200"
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
