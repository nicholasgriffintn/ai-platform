import { Button } from "@ngriffin_uk/polychat-component-ui";
import { ArrowRight, Sparkles } from "lucide-react";
import { useState } from "react";

import { MemoizedMarkdown } from "../../markdown";
import { Favicon } from "../../prose";
import type { ToolInteractionHandler } from "../registry";

export function WebSearchView({
  data,
  embedded,
  onToolInteraction,
  toolName = "web_search",
}: {
  data: any;
  embedded: boolean;
  onToolInteraction?: ToolInteractionHandler;
  toolName?: string;
}) {
  const [showAllSources, setShowAllSources] = useState(false);

  if (!data) {
    return <p className="text-red-500">No search data available</p>;
  }

  const { answer, sources, similarQuestions, completion_id, provider, providerWarning } = data;

  const providerLabels: Record<string, string> = {
    duckduckgo: "DuckDuckGo",
    tavily: "Tavily",
    serper: "Serper",
    parallel: "Parallel",
  };

  const providerLabel = (provider && providerLabels[provider]) || provider || null;

  const getDomain = (url: string) => {
    try {
      return url.replace(/(https?:\/\/)?(www\.)?/i, "").split("/")[0];
    } catch {
      return url;
    }
  };

  const handleToggleSources = () => {
    setShowAllSources(!showAllSources);
  };

  const displayedSources = showAllSources ? sources : sources?.slice(0, 3);

  return (
    <div className="max-w-full overflow-x-hidden">
      <div className={embedded ? "mb-4" : "mb-6"}>
        {sources && sources.length > 0 && (
          <div className="flex items-center text-sm mb-2 text-zinc-600 dark:text-zinc-300">
            <ArrowRight className="h-5 w-5 mr-2" aria-hidden="true" />
            <span>{sources.length} sources</span>
          </div>
        )}

        {displayedSources?.length > 0 && (
          <div id="source-list" className="flex flex-wrap gap-2 mb-4">
            {displayedSources?.map((source: any) => (
              <a
                key={`source-card-${source.url}`}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group no-underline hover:!no-underline flex-1 min-w-[150px] rounded-md border border-zinc-200 p-3 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/60"
                aria-label={`View source: ${source.title}`}
              >
                <div className="flex items-center mb-2">
                  <Favicon url={source.url} />
                  <div className="text-xs text-zinc-600 dark:text-zinc-300 truncate">
                    {getDomain(source.url)}
                  </div>
                </div>
                <p className="text-sm font-medium line-clamp-2 text-zinc-600 group-hover:underline dark:text-zinc-300">
                  {source.title}
                </p>
              </a>
            ))}

            {!showAllSources && sources?.length > 3 && (
              <button
                type="button"
                onClick={handleToggleSources}
                className="flex min-w-[100px] cursor-pointer items-center justify-center rounded-md border border-zinc-200 p-3 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/60"
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
                className="flex min-w-[100px] cursor-pointer items-center justify-center rounded-md border border-zinc-200 p-3 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/60"
                aria-expanded={showAllSources}
                aria-controls="source-list"
              >
                <span className="text-zinc-600 dark:text-zinc-300">Show less</span>
              </button>
            )}
          </div>
        )}

        {providerLabel && (
          <div className="mt-2">
            <div className="inline-flex items-center gap-2 bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300 px-3 py-1 rounded-full w-fit">
              <span className="font-medium tracking-wide uppercase text-xs">Provider</span>
              <span className="font-medium text-xs">{providerLabel}</span>
            </div>
          </div>
        )}
      </div>

      <div className={`text-zinc-600 dark:text-zinc-300 ${embedded ? "mb-4" : "mb-6"}`}>
        <div className="prose dark:prose-invert text-zinc-600 dark:text-zinc-300">
          <MemoizedMarkdown>{answer}</MemoizedMarkdown>
        </div>
      </div>

      {similarQuestions && similarQuestions.length > 0 && (
        <div className={embedded ? "mt-4" : "mt-8"} aria-labelledby="similar-questions-heading">
          <h2
            id="similar-questions-heading"
            className={`mb-3 font-medium text-zinc-600 dark:text-zinc-300 ${embedded ? "text-sm" : "text-xl"}`}
          >
            People also ask
          </h2>
          <ul className="space-y-0">
            {similarQuestions.map((question: string, index: number) => (
              <li
                key={`question-${question}`}
                className={`border-t border-zinc-200 py-4 dark:border-zinc-700 ${
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
                        onToolInteraction?.(toolName, "useAsPrompt", {
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
        <div className="mt-6">
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

      {providerWarning && (
        <div className="mt-6 rounded-md border border-yellow-400/60 bg-yellow-50 dark:bg-yellow-500/10 text-yellow-800 dark:text-yellow-200 px-4 py-3">
          {providerWarning}
        </div>
      )}
    </div>
  );
}
