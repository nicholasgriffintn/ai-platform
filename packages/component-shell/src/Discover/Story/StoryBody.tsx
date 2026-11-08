import type { StoryPage } from "@ngriffin_uk/polychat-schemas";
import { formatRelativeTime } from "@ngriffin_uk/polychat-utility-core";
import type { ReactNode } from "react";

import { DiscoverHref } from "../Edition/DiscoverHref.js";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="polychat-eyebrow">{title}</h2>
      {children}
    </section>
  );
}

function Bullets({ items }: { items: readonly string[] }) {
  return (
    <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[0.95rem] leading-relaxed text-pretty text-foreground">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export function StoryBody({ page }: { page: StoryPage }) {
  const { story, version, articles } = page;

  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl leading-[1.15] font-medium tracking-tight text-balance text-foreground">
          {story.title}
        </h1>
        <p className="text-sm text-muted-foreground">
          {plural(story.outletCount, "outlet")} · {plural(story.articleCount, "article")} · Updated{" "}
          {formatRelativeTime(story.lastArticleAt)}
        </p>
      </header>
      <Section title="Overview">
        {version ? (
          <Bullets items={version.overview} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Poly is still gathering coverage of this story.
          </p>
        )}
      </Section>
      {version?.outlets.length ? (
        <Section title="How each outlet tells it">
          <ul className="flex flex-col gap-2 text-[0.95rem] leading-relaxed text-foreground">
            {version.outlets.map((outlet) => (
              <li key={outlet.source}>
                <span className="font-medium">{outlet.source}: </span>
                {outlet.angle}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
      {version?.agreed.length ? (
        <Section title="What they agree on">
          <Bullets items={version.agreed} />
        </Section>
      ) : null}
      {version?.disputed.length ? (
        <Section title="Where they differ">
          <Bullets items={version.disputed} />
        </Section>
      ) : null}
      {version?.gaps.length ? (
        <Section title="What's missing">
          <Bullets items={version.gaps} />
        </Section>
      ) : null}
      <Section title="Articles">
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
      </Section>
    </article>
  );
}
