import { getStoryPath } from "@ngriffin_uk/polychat-library-react";
import type { EntityPage } from "@ngriffin_uk/polychat-schemas";
import { formatCount, formatRelativeTime } from "@ngriffin_uk/polychat-utility-core";
import { Link } from "react-router";

import { StoryQuotes } from "./StoryQuotes.js";
import { StorySection } from "./StorySection.js";

export function EntityBody({ page }: { page: EntityPage }) {
  const { entity, stories, quotes } = page;
  const aliases = entity.aliases.filter((alias) => alias !== entity.name);
  const newestFirst = [...stories].sort((a, b) => b.lastArticleAt.localeCompare(a.lastArticleAt));

  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl leading-[1.15] font-medium tracking-tight text-balance text-foreground">
          {entity.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          {entity.kind} · {formatCount(entity.mentionCount, "mention")}
          {aliases.length ? ` · Also known as ${aliases.join(", ")}` : ""}
        </p>
      </header>
      {newestFirst.length ? (
        <StorySection title="Stories">
          <ul className="flex flex-col border-t border-border">
            {newestFirst.map((story) => (
              <li key={story.id} className="flex flex-col gap-0.5 border-b border-border py-3">
                <span className="text-xs text-muted-foreground">
                  {story.role} · {formatRelativeTime(story.lastArticleAt)}
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
        </StorySection>
      ) : null}
      {quotes.length ? (
        <StorySection title="Quotes">
          <StoryQuotes quotes={quotes} />
        </StorySection>
      ) : null}
    </article>
  );
}
