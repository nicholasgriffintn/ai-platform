import { useState } from "react";

import { Favicon } from "../prose";
import type { SourceRecord } from "./presentation";

const DEFAULT_VISIBLE = 4;

const readDomain = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return url;
  }
};

export function SourceListView({ sources }: { sources: SourceRecord[] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? sources : sources.slice(0, DEFAULT_VISIBLE);
  const hasMore = sources.length > DEFAULT_VISIBLE;

  if (sources.length === 0) {
    return null;
  }

  return (
    <div data-responsetype="sources" className="space-y-2">
      <ul className="grid gap-2 sm:grid-cols-2">
        {visible.map((source) => (
          <li key={source.url}>
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex h-full flex-col gap-1 rounded-md border border-zinc-200 p-3 no-underline transition-colors hover:bg-zinc-50 hover:!no-underline dark:border-zinc-700 dark:hover:bg-zinc-800/60"
            >
              <span className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                <Favicon url={source.url} className="h-4 w-4 rounded-sm" />
                <span className="truncate">{readDomain(source.url)}</span>
              </span>
              <span className="line-clamp-2 text-sm font-medium text-zinc-800 group-hover:underline dark:text-zinc-100">
                {source.title || readDomain(source.url)}
              </span>
              {source.snippet && (
                <span className="line-clamp-2 text-xs text-zinc-600 dark:text-zinc-400">
                  {source.snippet}
                </span>
              )}
            </a>
          </li>
        ))}
      </ul>
      {hasMore && (
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
          aria-expanded={showAll}
        >
          {showAll ? "Show fewer" : `Show ${sources.length - DEFAULT_VISIBLE} more`}
        </button>
      )}
    </div>
  );
}
