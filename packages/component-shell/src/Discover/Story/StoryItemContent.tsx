import type { StoryPage } from "@ngriffin_uk/polychat-schemas";
import { formatCount } from "@ngriffin_uk/polychat-utility-core";

import { storyKicker, storyOutletRows, storyTimeline } from "./story-item.js";
import { hasStoryAngles, StoryAngles } from "./StoryAngles.js";
import { StoryArticles } from "./StoryArticles.js";
import { StoryBullets } from "./StoryBullets.js";
import { RelatedStories, StoryEntityChips } from "./StoryConnections.js";
import { StoryHistory } from "./StoryHistory.js";
import { StoryOutlets } from "./StoryOutlets.js";
import { StoryQuotes } from "./StoryQuotes.js";
import { StorySection } from "./StorySection.js";
import { StoryWorldPanel } from "./StoryWorldPanel.js";

export function StoryItemContent({
  page,
  onOpenStory,
  onOpenEntity,
}: {
  page: StoryPage;
  onOpenStory: (storyId: string) => void;
  onOpenEntity: (entityId: string) => void;
}) {
  const { story, version, history, coverage, articles, quotes, entities, before } = page;
  const outlets = storyOutletRows(coverage, version?.outlets ?? [], articles);
  const timeline = storyTimeline(history);

  return (
    <article className="flex min-w-0 flex-col gap-7">
      <header data-stagger className="flex flex-col gap-2">
        <p className="polychat-eyebrow">{storyKicker(story)}</p>
        <h2 className="font-display text-2xl leading-tight font-medium tracking-tight text-balance text-foreground sm:text-[1.75rem]">
          {story.title}
        </h2>
      </header>
      {version ? (
        <div data-stagger>
          <StoryBullets items={version.overview} />
        </div>
      ) : (
        <div
          data-stagger
          className="flex flex-col gap-1 rounded-2xl border border-dashed border-border bg-surface p-4"
        >
          <p className="text-sm text-foreground">
            Poly writes the overview when a second outlet reports it
          </p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {formatCount(story.outletCount, "outlet")} ·{" "}
            {formatCount(story.articleCount, "article")} so far
          </p>
        </div>
      )}
      {timeline.length ? <StoryHistory timeline={timeline} /> : null}
      {outlets.length ? (
        <StorySection title="Outlets">
          <StoryOutlets rows={outlets} />
        </StorySection>
      ) : null}
      {version && hasStoryAngles(version) ? <StoryAngles version={version} /> : null}
      {quotes.length ? (
        <StorySection title="Quotes">
          <StoryQuotes quotes={quotes} onOpenEntity={onOpenEntity} />
        </StorySection>
      ) : null}
      {entities.length ? (
        <StorySection title="People and organisations">
          <StoryEntityChips entities={entities} onOpenEntity={onOpenEntity} />
        </StorySection>
      ) : null}
      {before.length ? (
        <StorySection title="Before this">
          <RelatedStories stories={before} onOpenStory={onOpenStory} />
        </StorySection>
      ) : null}
      <StoryWorldPanel storyId={story.id} />
      {articles.length ? (
        <StorySection title="Articles">
          <StoryArticles articles={articles} />
        </StorySection>
      ) : null}
    </article>
  );
}
