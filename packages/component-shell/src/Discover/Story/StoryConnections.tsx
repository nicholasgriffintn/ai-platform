import type { RelatedStory, StoryEntityMention } from "@ngriffin_uk/polychat-schemas";
import {
  capitaliseFirst,
  formatCount,
  formatRelativeTime,
} from "@ngriffin_uk/polychat-utility-core";

import { DiscoverCompactRow } from "../Edition/DiscoverCompactRow.js";

export function StoryEntityChips({
  entities,
  onOpenEntity,
}: {
  entities: readonly StoryEntityMention[];
  onOpenEntity: (entityId: string) => void;
}) {
  return (
    <ul className="flex flex-wrap gap-2">
      {entities.map((entity) => (
        <li key={entity.id} className="max-w-full">
          <button
            type="button"
            onClick={() => onOpenEntity(entity.id)}
            className="inline-flex max-w-full items-baseline gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-sm text-foreground transition-colors hover:border-border-strong hover:bg-surface-elevated focus-visible:ring-2 focus-visible:ring-active-work focus-visible:outline-none"
          >
            <span className="truncate">{entity.name}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {capitaliseFirst(entity.kind)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function RelatedStories({
  stories,
  onOpenStory,
}: {
  stories: readonly RelatedStory[];
  onOpenStory: (storyId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {stories.map((story) => (
        <DiscoverCompactRow
          key={story.id}
          kicker={[
            story.kind === "background" ? "Background" : null,
            formatCount(story.outletCount, "outlet"),
            formatRelativeTime(story.lastArticleAt),
          ]
            .filter(Boolean)
            .join(" · ")}
          title={story.title}
          onOpen={() => onOpenStory(story.id)}
        />
      ))}
    </div>
  );
}
