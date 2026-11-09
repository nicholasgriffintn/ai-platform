import type { CoverageTracker } from "@ngriffin_uk/polychat-schemas";
import { TrendingDown, TrendingUp } from "lucide-react";

import { sortedWeekNames } from "./angles-week.js";
import { Sparkline } from "./Sparkline.js";

export function WeekNames({
  tracker,
  limit,
  onOpenEntity,
}: {
  tracker: CoverageTracker;
  limit?: number;
  onOpenEntity: (entityId: string) => void;
}) {
  const names = sortedWeekNames(tracker).slice(0, limit);

  if (names.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No name moved much between the two weeks.</p>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-border">
      {names.map((name) => {
        const rising = name.trend === "rising";
        const Icon = rising ? TrendingUp : TrendingDown;

        return (
          <li key={name.key}>
            <button
              type="button"
              onClick={() => onOpenEntity(name.key)}
              className="flex w-full items-center gap-3 rounded-md py-2 text-left transition-colors hover:bg-surface-elevated focus-visible:ring-2 focus-visible:ring-active-work focus-visible:outline-none"
            >
              <Icon
                size={14}
                aria-label={rising ? "Rising" : "Fading"}
                className={rising ? "shrink-0 text-active-work" : "shrink-0 text-muted-foreground"}
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium text-foreground">{name.term}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {name.current} this week · {name.previous} last week
                </span>
              </span>
              <Sparkline
                counts={name.days}
                label={`${name.term}, articles a day over two weeks: ${name.days.join(", ")}`}
                colour={rising ? "var(--chart-1)" : "var(--muted-foreground)"}
                className="w-16"
              />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
