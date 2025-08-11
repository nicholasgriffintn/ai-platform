import { ArrowRight, Sparkles } from "lucide-react";
import { useState } from "react";

import { Button, Favicon } from "~/components/ui";
import { MemoizedMarkdown } from "~/components/ui/Markdown";

export function WebSearchView({
  data,
  embedded,
  onToolInteraction,
}: {
  data: any;
  embedded: boolean;
  onToolInteraction?: (
    toolName: string,
    action: "useAsPrompt",
    data: Record<string, any>,
  ) => void;
}) {
  const [showAllSources, setShowAllSources] = useState(false);

  if (!data) {
    return <p className="text-red-500">No search data available</p>;
  }

  // Dev aid
  // eslint-disable-next-line no-console
  console.debug?.("WebSearchView:data", data);

  const answer: string = typeof data.answer === "string" ? data.answer : "";
  const sources: any[] = Array.isArray(data.sources) ? data.sources : [];
  const similarQuestions: string[] = Array.isArray(data.similarQuestions)
    ? data.similarQuestions
    : [];
  const completion_id: string | undefined = data.completion_id;

  const getDomain = (url: string) => {
    try {
      return url.replace(/(https?:\/\/)?(www\.)?/i, "").split("/")[0];
    } catch (_e) {
      return url;
    }
  };

  const handleToggleSources = () => {
    setShowAllSources(!showAllSources);
  };

  const displayedSources = showAllSources ? sources : sources?.slice(0, 3);

  return (
    <div className="max-w-full overflow-x-hidden" data-testid="web-search-view">
      <div className="mb-6">
        <div className="flex items-center text-sm mb-2 text-zinc-600 dark:text-zinc-300">
          <ArrowRight className="h-5 w-5 mr-2" aria-hidden="true" />
          <span data-testid="source-count">{sources?.length || 0} sources</span>
        </div>

        <div id="source-list" className="flex flex-wrap gap-2 mb-4">
          {displayedSources?.map((source: any) => {
            const url = source?.url || "#";
            const title = source?.title || getDomain(url);
            const encrypted = !!source?.encrypted_content;
            return (
              <a
                key={`source-card-${url}`}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-[150px] border border-gray-700 rounded-md p-3 hover:bg-gray-800 transition-colors"
                aria-label={`View source: ${title}`}
                data-testid="source-card"
              >
                <div className="flex items-center mb-2">
                  <Favicon url={url} />
                  <div className="text-xs text-zinc-600 dark:text-zinc-300 truncate">
                    {getDomain(url)}
                  </div>
                </div>
                <p className="text-sm font-medium line-clamp-2 text-zinc-600 dark:text-zinc-300">
                  {title}
                </p>
                {encrypted && (
                  <p className="mt-1 text-xs text-zinc-500" data-testid="encrypted-indicator">
                    Content not available
                  </p>
                )}
              </a>
            );
          })}

          {!showAllSources && sources?.length > 3 && (
            <button
              type="button"
              onClick={handleToggleSources}
              className="flex items-center justify-center min-w-[100px] p-3 border border-gray-700 rounded-md hover:bg-gray-800 transition-colors cursor-pointer"
              aria-expanded={showAllSources}
              aria-controls="source-list"
              data-testid="show-more-sources"
            >
              <span className="text-zinc-600 dark:text-zinc-300">
                +{sources.length - 3} sources
              </span>
            </button>
          )}

          {showAllSources && sources?.length > 3 && (
            <button
              type="button"
              onClick={handleToggleSources}
              className="flex items-center justify-center min-w-[100px] p-3 border border-gray-700 rounded-md hover:bg-gray-800 transition-colors cursor-pointer"
              aria-expanded={showAllSources}
              aria-controls="source-list"
              data-testid="show-less-sources"
            >
              <span className="text-zinc-600 dark:text-zinc-300">Show less</span>
            </button>
          )}
        </div>
      </div>

      <div className="mb-6 text-zinc-600 dark:text-zinc-300">
        <div className="prose dark:prose-invert text-zinc-600 dark:text-zinc-300">
          <MemoizedMarkdown>{answer || ""}</MemoizedMarkdown>
        </div>
      </div>

      {similarQuestions && similarQuestions.length > 0 && (
        <div className="mt-8" aria-labelledby="similar-questions-heading">
          <h2
            id="similar-questions-heading"
            className="text-xl font-medium mb-4 text-zinc-600 dark:text-zinc-300"
          >
            People also ask
          </h2>
          <ul className="space-y-0">
            {similarQuestions.map((question: string, index: number) => (
              <li
                key={`question-${question}`}
                className={`border-t border-gray-700 py-4 ${index === similarQuestions.length - 1 ? "border-b" : ""}`}
              >
                <div className="flex justify-between items-center">
                  <p className="text-zinc-600 dark:text-zinc-300">{question}</p>
                  {embedded && onToolInteraction && (
                    <Button
                      type="button"
                      variant="icon"
                      icon={<Sparkles />}
                      aria-label={`Use question "${question}" as a prompt`}
                      title="Use this question as a prompt"
                      onClick={() => {
                        onToolInteraction?.(data.name, "useAsPrompt", {
                          question,
                        });
                      }}
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {completion_id && !embedded && (
        <div className="mt-8">
          <button
            type="button"
            className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition-colors"
            onClick={() => {
              window.open(`/?completion_id=${completion_id}`, "_blank");
            }}
            aria-label="Continue the conversation in a new window"
          >
            Continue the conversation
          </button>
        </div>
      )}
    </div>
  );
}
