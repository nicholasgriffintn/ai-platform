import type { CoverageTracker } from "@ngriffin_uk/polychat-schemas";
import { formatPercentFraction } from "@ngriffin_uk/polychat-utility-core";

const HEATMAP_TOPIC_LIMIT = 8;

export function AttentionHeatmap({ tracker }: { tracker: CoverageTracker }) {
  const topics = tracker.topics.filter((topic) =>
    tracker.heatmap.cells.some((cell) => cell.topicKey === topic.key),
  );
  const shown = topics.slice(0, HEATMAP_TOPIC_LIMIT);
  const cells = new Map(
    tracker.heatmap.cells.map((cell) => [`${cell.outletId}\u0000${cell.topicKey}`, cell]),
  );

  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
      <table className="border-separate border-spacing-0.5 text-xs">
        <caption className="sr-only">
          Share of each outlet's articles by topic over the last four weeks
        </caption>
        <thead>
          <tr>
            <th
              scope="col"
              className="sticky left-0 z-10 bg-background pr-2 text-left font-normal text-muted-foreground"
            >
              Outlet
            </th>
            {shown.map((topic) => (
              <th
                key={topic.key}
                scope="col"
                className="px-1 pb-1 text-center font-normal whitespace-nowrap text-muted-foreground"
              >
                {topic.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tracker.heatmap.outlets.map((outlet) => (
            <tr key={outlet.id}>
              <th
                scope="row"
                className="sticky left-0 z-10 bg-background pr-2 text-left font-normal text-foreground"
              >
                <span className="flex max-w-32 items-baseline gap-1">
                  <span className="truncate">{outlet.name}</span>
                  <span className="shrink-0 text-muted-foreground tabular-nums">
                    {outlet.articleCount}
                  </span>
                </span>
              </th>
              {shown.map((topic) => {
                const cell = cells.get(`${outlet.id}\u0000${topic.key}`);
                const share = cell?.share ?? 0;

                return (
                  <td
                    key={topic.key}
                    title={`${outlet.name}, ${topic.label}: ${cell?.articleCount ?? 0} articles, ${formatPercentFraction(share)} of its coverage`}
                    className="h-7 min-w-12 rounded-sm text-center tabular-nums"
                    style={{
                      backgroundColor: `color-mix(in oklab, var(--chart-2) ${Math.round(share * 100)}%, var(--muted))`,
                      color: share > 0.45 ? "var(--background)" : "var(--foreground)",
                    }}
                  >
                    {cell ? formatPercentFraction(share) : ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
