import type { CoverageTracker } from "@ngriffin_uk/polychat-schemas";
import { formatCount, formatShortCalendarDate } from "@ngriffin_uk/polychat-utility-core";

import { Sparkline } from "./Sparkline.js";

export function TermTrends({
  tracker,
  onOpenEntity,
}: {
  tracker: CoverageTracker;
  onOpenEntity: (entityId: string) => void;
}) {
  if (tracker.terms.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Names appear once stories have been written up.
      </p>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-border">
      {tracker.terms.map((term) => {
        const byWeek = new Map(term.weeks.map((week) => [week.week, week.articleCount]));
        const counts = tracker.weeks.map((week) => byWeek.get(week) ?? 0);
        const latest = counts.at(-1) ?? 0;
        const description = tracker.weeks
          .map((week, index) => `${formatShortCalendarDate(week)}: ${counts[index] ?? 0}`)
          .join(", ");

        return (
          <li key={term.key}>
            <button
              type="button"
              onClick={() => onOpenEntity(term.key)}
              className="flex w-full items-center gap-3 rounded-md py-2.5 text-left transition-colors hover:bg-surface focus-visible:ring-2 focus-visible:ring-active-work focus-visible:outline-none"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium text-foreground">{term.term}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatCount(term.total, "article")} · {latest} since Monday
                </span>
              </span>
              <Sparkline counts={counts} label={`${term.term} by week: ${description}`} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
