import type { EntityPage } from "@ngriffin_uk/polychat-schemas";
import {
  capitaliseFirst,
  formatCount,
  formatRelativeTime,
} from "@ngriffin_uk/polychat-utility-core";

import { DiscoverCompactRow } from "../Edition/DiscoverCompactRow.js";
import { EntityFollowButton } from "./EntityFollowButton.js";
import { OutletMark } from "./OutletMark.js";
import { StoryQuotes } from "./StoryQuotes.js";
import { StorySection } from "./StorySection.js";

const OUTLET_LIMIT = 6;

function EntityOutlets({ outlets }: { outlets: EntityPage["outlets"] }) {
  const top = [...outlets]
    .sort((left, right) => right.articleCount - left.articleCount)
    .slice(0, OUTLET_LIMIT);
  const peak = Math.max(1, ...top.map((outlet) => outlet.articleCount));

  return (
    <ul className="flex flex-col gap-2.5">
      {top.map((outlet) => (
        <li key={outlet.outlet} className="flex items-center gap-3">
          <OutletMark name={outlet.outlet} url={null} className="size-7 rounded-md" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-sm text-foreground">{outlet.outlet}</span>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {formatCount(outlet.articleCount, "article")}
              </span>
            </div>
            <span aria-hidden className="h-1 overflow-hidden rounded-full bg-muted">
              <span
                className="block h-full rounded-full bg-[var(--chart-1)]"
                style={{ width: `${(outlet.articleCount / peak) * 100}%` }}
              />
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function EntityItemContent({
  page,
  onOpenStory,
}: {
  page: EntityPage;
  onOpenStory: (storyId: string) => void;
}) {
  const { entity, stories, quotes, outlets } = page;
  const aliases = entity.aliases.filter((alias) => alias !== entity.name);
  const newestFirst = [...stories].sort((left, right) =>
    right.lastArticleAt.localeCompare(left.lastArticleAt),
  );

  return (
    <article className="flex min-w-0 flex-col gap-7">
      <header data-stagger className="flex flex-col gap-2">
        <p className="polychat-eyebrow">
          {capitaliseFirst(entity.kind)} · {formatCount(entity.mentionCount, "mention")}
        </p>
        <h2 className="font-display text-2xl leading-tight font-medium tracking-tight text-balance text-foreground sm:text-[1.75rem]">
          {entity.name}
        </h2>
        {aliases.length ? (
          <p className="text-sm text-muted-foreground">Also known as {aliases.join(", ")}</p>
        ) : null}
        <EntityFollowButton name={entity.name} />
      </header>
      {newestFirst.length ? (
        <StorySection title="Stories over time">
          <div className="flex flex-col gap-2">
            {newestFirst.map((story) => (
              <DiscoverCompactRow
                key={story.id}
                kicker={`${capitaliseFirst(story.role)} · ${formatCount(story.outletCount, "outlet")} · ${formatRelativeTime(story.lastArticleAt)}`}
                title={story.title}
                onOpen={() => onOpenStory(story.id)}
              />
            ))}
          </div>
        </StorySection>
      ) : null}
      {quotes.length ? (
        <StorySection title="In their words">
          <StoryQuotes quotes={quotes} />
        </StorySection>
      ) : null}
      {outlets.length ? (
        <StorySection title="Outlets that mention them most">
          <EntityOutlets outlets={outlets} />
        </StorySection>
      ) : null}
    </article>
  );
}
