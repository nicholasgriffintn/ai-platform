import { CitationList } from "./CitationList";

interface SearchGroundingProps {
  searchGrounding: {
    searchEntryPoint?: {
      renderedContent: string;
    };
    groundingChunks?: Array<{
      web?: {
        uri: string;
        title: string;
      };
    }>;
    groundingSupports?: Array<{
      segment: {
        startIndex: number;
        endIndex: number;
        text: string;
      };
      groundingChunkIndices: number[];
      confidenceScores: number[];
    }>;
    webSearchQueries?: string[];
  };
}

export const SearchGroundingSection = ({ searchGrounding }: SearchGroundingProps) => {
  if (
    !searchGrounding ||
    (!searchGrounding.groundingChunks?.length && !searchGrounding.webSearchQueries?.length)
  ) {
    return null;
  }

  const sources = searchGrounding.groundingChunks || [];
  const sourceUrls = sources
    .map((source) => {
      return {
        url: source.web?.uri || "",
        title: source.web?.title || "",
      };
    })
    .filter((source) => source.url);

  return (
    <div className="mb-4 mt-2">
      <div className="mt-3">
        {searchGrounding.webSearchQueries && searchGrounding.webSearchQueries?.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2 w-full">
            <span className="text-sm text-zinc-500 dark:text-zinc-400">Queries:</span>
            {searchGrounding.webSearchQueries?.map((query, index) => (
              <a
                key={`query-${index}`}
                href={`https://www.google.com/search?q=${encodeURIComponent(query)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-zinc-100 px-2 py-1 text-xs text-zinc-700 no-underline transition-colors hover:bg-zinc-200 hover:!no-underline dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                {query}
              </a>
            ))}
          </div>
        )}

        {sourceUrls.length > 0 && <CitationList citations={sourceUrls} maxDisplayed={5} />}
      </div>
    </div>
  );
};
