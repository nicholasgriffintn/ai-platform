import type { StoryPage } from "@ngriffin_uk/polychat-schemas";
import { formatCount, formatRelativeTime } from "@ngriffin_uk/polychat-utility-core";

import { DiscoverHref } from "../Edition/DiscoverHref.js";
import { RelatedStories, StoryEntityChips } from "./StoryConnections.js";
import { StoryQuotes } from "./StoryQuotes.js";
import { StorySection } from "./StorySection.js";

function Bullets({ items }: { items: readonly string[] }) {
  return (
    <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[0.95rem] leading-relaxed text-pretty text-foreground">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function StoryBody({ page }: { page: StoryPage }) {
  const { story, version, articles, quotes, entities, before } = page;

  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl leading-[1.15] font-medium tracking-tight text-balance text-foreground">
          {story.title}
        </h1>
        <p className="text-sm text-muted-foreground">
          {formatCount(story.outletCount, "outlet")} · {formatCount(story.articleCount, "article")}{" "}
          · Updated {formatRelativeTime(story.lastArticleAt)}
        </p>
      </header>
      <StorySection title="Overview">
        {version ? (
          <Bullets items={version.overview} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Poly is still gathering coverage of this story.
          </p>
        )}
      </StorySection>
      {quotes.length ? (
        <StorySection title="Quotes">
          <StoryQuotes quotes={quotes} />
        </StorySection>
      ) : null}
      {version?.outlets.length ? (
        <StorySection title="How each outlet tells it">
          <ul className="flex flex-col gap-2 text-[0.95rem] leading-relaxed text-foreground">
            {version.outlets.map((outlet) => (
              <li key={outlet.source}>
                <span className="font-medium">{outlet.source}: </span>
                {outlet.angle}
              </li>
            ))}
          </ul>
        </StorySection>
      ) : null}
      {version?.agreed.length ? (
        <StorySection title="What they agree on">
          <Bullets items={version.agreed} />
        </StorySection>
      ) : null}
      {version?.disputed.length ? (
        <StorySection title="Where they differ">
          <Bullets items={version.disputed} />
        </StorySection>
      ) : null}
      {version?.gaps.length ? (
        <StorySection title="What's missing">
          <Bullets items={version.gaps} />
        </StorySection>
      ) : null}
      {entities.length ? (
        <StorySection title="People and organisations">
          <StoryEntityChips entities={entities} />
        </StorySection>
      ) : null}
      {before.length ? (
        <StorySection title="Before this">
          <RelatedStories stories={before} />
        </StorySection>
      ) : null}
      <StorySection title="Articles">
        <ul className="flex flex-col border-t border-border">
          {articles.map((article) => (
            <li key={article.id} className="flex flex-col gap-0.5 border-b border-border py-3">
              <span className="text-xs text-muted-foreground">
                {article.outlet} · {formatRelativeTime(article.publishedAt)}
              </span>
              <DiscoverHref
                href={article.url}
                className="text-sm font-medium text-foreground underline underline-offset-2"
              >
                {article.headline}
              </DiscoverHref>
              {article.standfirst ? (
                <p className="text-sm text-muted-foreground">{article.standfirst}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </StorySection>
    </article>
  );
}
