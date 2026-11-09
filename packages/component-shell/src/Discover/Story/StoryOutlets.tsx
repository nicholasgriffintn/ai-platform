import { formatCount } from "@ngriffin_uk/polychat-utility-core";

import { OutletMark } from "./OutletMark.js";
import type { StoryOutletRow } from "./story-item.js";

export function StoryOutlets({ rows }: { rows: readonly StoryOutletRow[] }) {
  return (
    <ul className="flex flex-col divide-y divide-border">
      {rows.map(({ outlet, url, coverage, angle }) => (
        <li key={outlet} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
          <OutletMark name={outlet} url={url} />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-sm font-medium text-foreground">{outlet}</span>
              {coverage ? (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatCount(coverage.articleCount, "article")}
                </span>
              ) : null}
              {coverage && coverage.leadCount > 0 ? (
                <span className="rounded-full bg-active-work/12 px-2 py-0.5 text-[0.6875rem] font-medium text-active-work">
                  Broke the story
                </span>
              ) : null}
            </p>
            {angle ? (
              <p className="text-sm leading-relaxed text-pretty text-muted-foreground">{angle}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
