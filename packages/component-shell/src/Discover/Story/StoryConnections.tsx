import { getStoryEntityPath, getStoryPath } from "@ngriffin_uk/polychat-library-react";
import type { RelatedStory, StoryEntityMention } from "@ngriffin_uk/polychat-schemas";
import { formatCount, formatRelativeTime } from "@ngriffin_uk/polychat-utility-core";
import { Link } from "react-router";

export function StoryEntityChips({ entities }: { entities: readonly StoryEntityMention[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {entities.map((entity) => (
        <li key={entity.id}>
          <Link
            to={getStoryEntityPath(entity.id)}
            className="inline-flex items-baseline gap-1.5 rounded-full border border-border px-3 py-1 text-sm text-foreground transition-colors hover:bg-muted"
          >
            {entity.name}
            <span className="text-xs text-muted-foreground">{entity.kind}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function RelatedStories({ stories }: { stories: readonly RelatedStory[] }) {
  return (
    <ul className="flex flex-col border-t border-border">
      {stories.map((story) => (
        <li key={story.id} className="flex flex-col gap-0.5 border-b border-border py-3">
          <span className="text-xs text-muted-foreground">
            {story.kind === "background" ? "Background · " : ""}
            {formatCount(story.outletCount, "outlet")} · {formatRelativeTime(story.lastArticleAt)}
          </span>
          <Link
            to={getStoryPath(story.id)}
            className="text-sm font-medium text-foreground underline underline-offset-2"
          >
            {story.title}
          </Link>
        </li>
      ))}
    </ul>
  );
}
