import type { CoverageTracker } from "@ngriffin_uk/polychat-schemas";
import { formatCount } from "@ngriffin_uk/polychat-utility-core";

import { weekAttention, type WeekBar } from "./angles-week.js";
import { TopicLegend } from "./TopicLegend.js";

function Bar({
  outlet,
  period,
  bar,
  peak,
  faded,
}: {
  outlet: string;
  period: string;
  bar: WeekBar;
  peak: number;
  faded: boolean;
}) {
  return (
    <div
      className="flex h-1.5 gap-px overflow-hidden rounded-full bg-muted"
      title={`${outlet}, ${period}: ${formatCount(bar.total, "article")}`}
    >
      <div
        className="flex h-full gap-px"
        style={{ width: `${(bar.total / peak) * 100}%`, opacity: faded ? 0.55 : 1 }}
      >
        {bar.segments.map((segment) => (
          <span
            key={segment.key}
            title={`${outlet}, ${period}: ${segment.label}, ${formatCount(segment.articleCount, "article")}`}
            className="h-full"
            style={{
              width: `${(segment.articleCount / bar.total) * 100}%`,
              backgroundColor: segment.colour,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function WeekAttentionBars({
  tracker,
  limit,
}: {
  tracker: CoverageTracker;
  limit?: number;
}) {
  const { swatches, outlets: allOutlets, peak } = weekAttention(tracker);
  const outlets = allOutlets.slice(0, limit);

  if (outlets.length === 0) {
    return <p className="text-sm text-muted-foreground">No articles from your outlets yet.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <TopicLegend swatches={swatches} />
      <ul className="flex flex-col gap-2.5">
        {outlets.map((outlet) => (
          <li key={outlet.id} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span className="truncate text-foreground">{outlet.name}</span>
              <span className="shrink-0 text-muted-foreground tabular-nums">
                {outlet.current.total}
                <span className="text-muted-foreground/70"> / {outlet.previous.total}</span>
              </span>
            </div>
            <Bar
              outlet={outlet.name}
              period="this week"
              bar={outlet.current}
              peak={peak}
              faded={false}
            />
            <Bar outlet={outlet.name} period="last week" bar={outlet.previous} peak={peak} faded />
          </li>
        ))}
      </ul>
      <p className="text-[0.6875rem] text-muted-foreground">
        Top bar this week, lower bar last week
      </p>
    </div>
  );
}
