import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

export function DiscoverAnalysisTags({ tags }: { tags: readonly string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <span key={tag} className="rounded-full border border-border px-2 py-0.5 text-[0.7rem]">
          {tag}
        </span>
      ))}
    </div>
  );
}

export function DiscoverAnalysisSection({
  heading,
  count,
  children,
}: {
  heading: string;
  count?: number;
  children: ReactNode;
}) {
  return (
    <details className="group border-t border-border pt-2">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 font-medium hover:text-foreground [&::-webkit-details-marker]:hidden">
        <ChevronRight
          size={13}
          className="shrink-0 transition-transform group-open:rotate-90"
          aria-hidden
        />
        {heading}
        {count === undefined ? null : <span className="font-normal">· {count}</span>}
      </summary>
      <div className="pt-2 pl-5 text-[0.8125rem] leading-relaxed text-foreground">{children}</div>
    </details>
  );
}

export function DiscoverAnalysisList({
  heading,
  items,
}: {
  heading: string;
  items: readonly string[];
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <DiscoverAnalysisSection heading={heading} count={items.length > 1 ? items.length : undefined}>
      {items.length === 1 ? (
        <p>{items[0]}</p>
      ) : (
        <ul className="flex list-disc flex-col gap-1 pl-4">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </DiscoverAnalysisSection>
  );
}
