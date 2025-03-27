import { Search } from "lucide-react";

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

export const SearchGroundingSection = ({
  searchGrounding,
}: SearchGroundingProps) => {
  if (
    !searchGrounding ||
    (!searchGrounding.groundingChunks?.length &&
      !searchGrounding.webSearchQueries?.length)
  ) {
    return null;
  }

  const sources = searchGrounding.groundingChunks || [];
  const sourceUrls = sources
    .filter((source) => source.web?.uri)
    .map((source) => source.web?.uri as string);

  return (
    <div className="mb-4 mt-2">
      <div className="mt-3">
        {searchGrounding.webSearchQueries &&
          searchGrounding.webSearchQueries?.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2 w-full">
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                Queries:
              </span>
              {searchGrounding.webSearchQueries?.map((query, index) => (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: There's no ID provided
                  key={`query-${index}`}
                  className="text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-full text-zinc-700 dark:text-zinc-300 hover:underline"
                >
                  <a
                    href={`https://www.google.com/search?q=${query}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {query}
                  </a>
                </div>
              ))}
            </div>
          )}

        {sourceUrls.length > 0 && (
          <CitationList citations={sourceUrls} maxDisplayed={5} />
        )}
      </div>
    </div>
  );
};
