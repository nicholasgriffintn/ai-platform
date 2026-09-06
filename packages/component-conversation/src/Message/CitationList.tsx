import { Favicon } from "@ngriffin_uk/polychat-component-content";
import { useState } from "react";

interface CitationListProps {
  citations:
    | {
        url: string;
        title?: string;
      }[]
    | string[];
  maxDisplayed?: number;
}

export const CitationList = ({ citations, maxDisplayed = 3 }: CitationListProps) => {
  const [showAllCitations, setShowAllCitations] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (citations.length === 0) {
    return null;
  }

  const displayedCitations = showAllCitations ? citations : citations.slice(0, maxDisplayed);
  const hasMoreCitations = citations.length > maxDisplayed;

  if (displayedCitations.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 mb-2 flex items-center">
      <div className="mr-2 text-sm text-muted-foreground">Sources:</div>
      <div className="flex">
        {displayedCitations.map((url, index) => (
          <div
            key={typeof url === "string" ? url : url.url}
            className={`relative -ml-2 flex-shrink-0 first:ml-0 ${hoveredIndex === index ? "z-10" : "z-0"} transition-all duration-200`}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
            title={typeof url === "string" ? url : url.title || url.url}
          >
            <a
              href={typeof url === "string" ? url : url.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`block no-underline ${hoveredIndex === index ? "scale-125 transform" : ""} transition-all duration-200 ease-in-out`}
              aria-label={`Citation source: ${typeof url === "string" ? url : url.title || url.url}`}
            >
              <Favicon
                url={typeof url === "string" ? url : url.url}
                className={`h-6 w-6 rounded-full border border-border bg-surface object-contain p-[2px] ${hoveredIndex === index ? "shadow-md" : ""} `}
              />
            </a>
          </div>
        ))}
      </div>
      {hasMoreCitations && (
        <button
          type="button"
          onClick={() => setShowAllCitations(!showAllCitations)}
          className="ml-1 cursor-pointer text-xs text-muted-foreground hover:text-foreground"
          aria-label={
            showAllCitations
              ? "Show fewer citations"
              : `Show ${citations.length - maxDisplayed} more citations`
          }
        >
          {showAllCitations ? "Show less" : `+${citations.length - maxDisplayed} more`}
        </button>
      )}
    </div>
  );
};
