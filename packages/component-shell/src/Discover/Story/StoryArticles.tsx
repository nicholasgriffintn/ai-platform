import type { StoryArticle } from "@ngriffin_uk/polychat-schemas";
import { formatRelativeTime } from "@ngriffin_uk/polychat-utility-core";

import { DiscoverHref } from "../Edition/DiscoverHref.js";
import { OutletMark } from "./OutletMark.js";

export function StoryArticles({ articles }: { articles: readonly StoryArticle[] }) {
  return (
    <ul className="flex flex-col divide-y divide-border">
      {articles.map((article) => (
        <li key={article.id} className="py-2.5 first:pt-0 last:pb-0">
          <DiscoverHref
            href={article.url}
            className="group flex items-start gap-3 rounded-md focus-visible:ring-2 focus-visible:ring-active-work focus-visible:outline-none"
          >
            <OutletMark name={article.outlet} url={article.url} className="size-7 rounded-md" />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-xs text-muted-foreground">
                {article.outlet} · {formatRelativeTime(article.publishedAt)}
              </span>
              <span className="line-clamp-2 text-sm leading-snug text-foreground group-hover:underline group-hover:underline-offset-2">
                {article.headline}
              </span>
            </span>
          </DiscoverHref>
        </li>
      ))}
    </ul>
  );
}
