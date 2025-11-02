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

  const {
    answer,
    sources,
    similarQuestions,
    completion_id,
    provider,
    providerWarning,
  } = data;

  const providerLabels: Record<string, string> = {
    duckduckgo: "DuckDuckGo",
    tavily: "Tavily",
    serper: "Serper",
    parallel: "Parallel",
  };

  const providerLabel =
    (provider && providerLabels[provider]) || provider || "Unknown provider";

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
    <div className="max-w-full overflow-x-hidden">
      <div className="mb-6">
        <div className="flex items-center text-sm mb-2 text-zinc-600 dark:text-zinc-300">
          <ArrowRight className="h-5 w-5 mr-2" aria-hidden="true" />
          <span>{sources?.length || 0} sources</span>
        </div>

        <div id="source-list" className="flex flex-wrap gap-2 mb-4">
          {displayedSources?.map((source: any) => (
            <a
              key={`source-card-${source.url}`}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="no-underline flex-1 min-w-[150px] border border-gray-700 rounded-md p-3 hover:bg-gray-800 transition-colors"
              aria-label={`View source: ${source.title}`}
            >
              <div className="flex items-center mb-2">
                <Favicon url={source.url} />
                <div className="text-xs text-zinc-600 dark:text-zinc-300 truncate">
                  {getDomain(source.url)}
                </div>
              </div>
              <p className="text-sm font-medium line-clamp-2 text-zinc-600 dark:text-zinc-300">
                {source.title}
              </p>
            </a>
          ))}

          {!showAllSources && sources?.length > 3 && (
            <button
              type="button"
              onClick={handleToggleSources}
              className="flex items-center justify-center min-w-[100px] p-3 border border-gray-700 rounded-md hover:bg-gray-800 transition-colors cursor-pointer"
              aria-expanded={showAllSources}
              aria-controls="source-list"
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
            >
              <span className="text-zinc-600 dark:text-zinc-300">
                Show less
              </span>
            </button>
          )}
        </div>
      </div>

      <div className="mb-6 text-zinc-600 dark:text-zinc-300">
        <div className="prose dark:prose-invert text-zinc-600 dark:text-zinc-300">
          <MemoizedMarkdown>{answer}</MemoizedMarkdown>
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
                className={`border-t border-gray-700 py-4 ${
                  index === similarQuestions.length - 1 ? "border-b" : ""
                }`}
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

      <div className="mt-8 space-y-4">
        {completion_id && !embedded && (
          <div>
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

        <div className="flex flex-col gap-3 text-sm">
          <div className="inline-flex items-center gap-2 bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300 px-3 py-1 rounded-full w-fit">
            <span className="font-medium tracking-wide uppercase text-xs">
              Provider
            </span>
            <span className="font-medium text-xs">{providerLabel}</span>
          </div>

          {providerWarning && (
            <div className="rounded-md border border-yellow-400/60 bg-yellow-50 dark:bg-yellow-500/10 text-yellow-800 dark:text-yellow-200 px-4 py-3">
              {providerWarning}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
