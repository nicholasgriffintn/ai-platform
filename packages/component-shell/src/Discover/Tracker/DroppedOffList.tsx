import type { CoverageTracker } from "@ngriffin_uk/polychat-schemas";
import { formatCount } from "@ngriffin_uk/polychat-utility-core";

import { DiscoverCompactRow } from "../Edition/DiscoverCompactRow.js";

export function DroppedOffList({
  stories,
  limit,
  onOpenStory,
}: {
  stories: CoverageTracker["droppedOff"];
  limit?: number;
  onOpenStory: (storyId: string) => void;
}) {
  if (stories.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No open story lost more than half its coverage this week.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {stories.slice(0, limit).map(({ story, previous, current }) => (
        <DiscoverCompactRow
          key={story.id}
          kicker={`${formatCount(previous, "article")} the week before · ${current} this week`}
          title={story.title}
          onOpen={() => onOpenStory(story.id)}
        />
      ))}
    </div>
  );
}
