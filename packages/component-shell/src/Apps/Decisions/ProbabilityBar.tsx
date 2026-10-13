import { cn } from "@ngriffin_uk/polychat-component-ui";
import { formatProbabilityPercent } from "@ngriffin_uk/polychat-utility-core";
import type { CSSProperties, ReactNode } from "react";

import { PROBABILITY_FILL_CLASS, probabilityTone } from "./probability.js";

export function ProbabilityBar({
  label,
  probability,
  detail,
  highlighted = false,
  fillClassName,
  delayMs = 0,
}: {
  label: ReactNode;
  probability: number;
  detail?: ReactNode;
  highlighted?: boolean;
  fillClassName?: string;
  delayMs?: number;
}) {
  const style: CSSProperties = {
    width: `${Math.max(1.5, Math.round(probability * 100))}%`,
    animationDelay: `${delayMs}ms`,
  };

  return (
    <div className="group space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span
          className={cn(
            "min-w-0 truncate text-sm",
            highlighted ? "font-medium text-foreground" : "text-muted-foreground",
          )}
        >
          {label}
        </span>
        <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
          {detail ?? formatProbabilityPercent(probability)}
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-border" aria-hidden>
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-700 ease-out motion-safe:animate-in motion-safe:duration-700 motion-safe:fill-mode-both motion-safe:slide-in-from-left-full",
            fillClassName ?? PROBABILITY_FILL_CLASS[probabilityTone(probability)],
          )}
          style={style}
        />
      </div>
    </div>
  );
}
