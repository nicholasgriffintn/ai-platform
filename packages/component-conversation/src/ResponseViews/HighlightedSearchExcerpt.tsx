import { findTextMatchRanges } from "@ngriffin_uk/polychat-utility-core";
import type { ReactNode } from "react";

export function HighlightedSearchExcerpt({ excerpt, terms }: { excerpt: string; terms: string[] }) {
  const ranges = findTextMatchRanges(excerpt, terms);

  if (ranges.length === 0) {
    return excerpt;
  }

  const parts: ReactNode[] = [];
  let cursor = 0;

  for (const [index, range] of ranges.entries()) {
    if (range.start > cursor) {
      parts.push(excerpt.slice(cursor, range.start));
    }

    parts.push(
      <mark key={`${range.start}-${index}`} className="rounded-sm bg-highlight text-foreground">
        {excerpt.slice(range.start, range.end)}
      </mark>,
    );
    cursor = range.end;
  }

  if (cursor < excerpt.length) {
    parts.push(excerpt.slice(cursor));
  }

  return parts;
}
