import type { CoverageTracker } from "@ngriffin_uk/polychat-schemas";
import { formatPercentFraction, formatShortCalendarDate } from "@ngriffin_uk/polychat-utility-core";

import { TopicLegend } from "./TopicLegend.js";
import { OTHER_TOPIC_COLOUR, TOPIC_SERIES_COLOURS, topicSwatches } from "./tracker-colours.js";

interface Segment {
  key: string;
  label: string;
  colour: string;
  articleCount: number;
  share: number;
}

function buildRows(tracker: CoverageTracker) {
  const named = tracker.topics.slice(0, TOPIC_SERIES_COLOURS.length);
  const namedKeys = new Set(named.map((topic) => topic.key));

  return tracker.weeks.map((week) => {
    const cells = tracker.topicShare.filter((cell) => cell.week === week);
    const total = cells.reduce((sum, cell) => sum + cell.articleCount, 0);
    const segments: Segment[] = named.map((topic, index) => {
      const cell = cells.find((entry) => entry.topicKey === topic.key);

      return {
        key: topic.key,
        label: topic.label,
        colour: TOPIC_SERIES_COLOURS[index] ?? OTHER_TOPIC_COLOUR,
        articleCount: cell?.articleCount ?? 0,
        share: cell?.share ?? 0,
      };
    });
    const otherCount = cells
      .filter((cell) => !namedKeys.has(cell.topicKey))
      .reduce((sum, cell) => sum + cell.articleCount, 0);

    if (otherCount > 0) {
      segments.push({
        key: "other",
        label: "Other",
        colour: OTHER_TOPIC_COLOUR,
        articleCount: otherCount,
        share: total > 0 ? otherCount / total : 0,
      });
    }

    return { week, total, segments: segments.filter((segment) => segment.articleCount > 0) };
  });
}

export function TopicShareChart({ tracker }: { tracker: CoverageTracker }) {
  const rows = buildRows(tracker);
  const swatches = topicSwatches(
    tracker.topics,
    tracker.topics.length > TOPIC_SERIES_COLOURS.length,
  );

  return (
    <div className="flex flex-col gap-3">
      <TopicLegend swatches={swatches} />
      <ul className="flex flex-col gap-1.5">
        {rows.map((row) => (
          <li key={row.week} className="grid grid-cols-[3.25rem_1fr_2.5rem] items-center gap-2">
            <span className="text-xs text-muted-foreground tabular-nums">
              {formatShortCalendarDate(row.week)}
            </span>
            <div className="flex h-3 gap-px overflow-hidden rounded-sm bg-muted">
              {row.segments.map((segment) => (
                <span
                  key={segment.key}
                  title={`${segment.label}: ${segment.articleCount} articles, ${formatPercentFraction(segment.share)} of the week`}
                  className="h-full"
                  style={{ width: `${segment.share * 100}%`, backgroundColor: segment.colour }}
                />
              ))}
            </div>
            <span className="text-right text-xs text-muted-foreground tabular-nums">
              {row.total}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
