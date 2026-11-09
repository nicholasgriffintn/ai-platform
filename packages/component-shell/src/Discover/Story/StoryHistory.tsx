import { Button } from "@ngriffin_uk/polychat-component-ui";
import { useState } from "react";

import type { StoryTimelineEntry } from "./story-item.js";
import { StorySection } from "./StorySection.js";

const HISTORY_PREVIEW = 2;

export function StoryHistory({ timeline }: { timeline: readonly StoryTimelineEntry[] }) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? timeline : timeline.slice(0, HISTORY_PREVIEW);

  return (
    <StorySection
      title="How it developed"
      action={
        timeline.length > HISTORY_PREVIEW ? (
          <Button variant="ghost" size="xs" onClick={() => setShowAll((current) => !current)}>
            {showAll ? "Show fewer" : `Show all ${timeline.length}`}
          </Button>
        ) : null
      }
    >
      <ol className="flex flex-col gap-3 border-l border-border pl-4">
        {shown.map((entry) => (
          <li key={entry.version} className="relative flex flex-col gap-0.5">
            <span
              aria-hidden
              className="absolute top-1.5 -left-[1.3125rem] size-2 rounded-full border border-border bg-background"
            />
            <span className="text-xs text-muted-foreground tabular-nums">{entry.date}</span>
            <span className="text-sm leading-relaxed text-pretty text-foreground">
              {entry.change}
            </span>
          </li>
        ))}
      </ol>
    </StorySection>
  );
}
