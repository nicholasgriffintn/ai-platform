import { Button } from "@ngriffin_uk/polychat-component-ui";
import { ArrowRight, Sparkles } from "lucide-react";
import { useState } from "react";

import { MemoizedMarkdown } from "../../markdown";
import { Favicon } from "../../prose";
import type { ToolInteractionHandler } from "../registry";
import { readWebSearchData } from "./web-search";

const PROVIDER_LABELS: Record<string, string> = {
  duckduckgo: "DuckDuckGo",
  tavily: "Tavily",
  serper: "Serper",
  parallel: "Parallel",
};

const COLLAPSED_SOURCE_COUNT = 3;

const getDomain = (url: string) => url.replace(/(https?:\/\/)?(www\.)?/i, "").split("/")[0];

export function WebSearchView({
  data,
  embedded,
  onToolInteraction,
  toolName = "web_search",
}: {
  data: unknown;
  embedded: boolean;
  onToolInteraction?: ToolInteractionHandler;
  toolName?: string;
}) {
  const [showAllSources, setShowAllSources] = useState(false);

  const search = readWebSearchData(data);

  if (!search) {
    return <p className="text-failure">No search data available</p>;
  }

  const { answer, sources, similarQuestions, completionId, provider, providerWarning } = search;

  const providerLabel = (provider && PROVIDER_LABELS[provider]) || provider || null;
  const hasHiddenSources = sources.length > COLLAPSED_SOURCE_COUNT;
  const displayedSources = showAllSources ? sources : sources.slice(0, COLLAPSED_SOURCE_COUNT);

  const handleToggleSources = () => {
    setShowAllSources(!showAllSources);
  };

  return (
    <div className="max-w-full overflow-x-hidden">
      <div className={embedded ? "mb-4" : "mb-6"}>
        {sources.length > 0 && (
          <div className="mb-2 flex items-center text-sm text-muted-foreground">
            <ArrowRight className="mr-2 h-5 w-5" aria-hidden="true" />
            <span>{sources.length} sources</span>
          </div>
        )}

        {displayedSources.length > 0 && (
          <div id="source-list" className="mb-4 flex flex-wrap gap-2">
            {displayedSources.map((source) => {
              const label = source.title ?? getDomain(source.url);

              return (
                <a
                  key={`source-card-${source.url}`}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group min-w-[150px] flex-1 rounded-md border border-border p-3 no-underline transition-colors hover:bg-surface-elevated hover:!no-underline"
                  aria-label={`View source: ${label}`}
                >
                  <div className="mb-2 flex items-center">
                    <Favicon url={source.url} />
                    <div className="truncate text-xs text-muted-foreground">
                      {getDomain(source.url)}
                    </div>
                  </div>
                  <p className="line-clamp-2 text-sm font-medium text-muted-foreground group-hover:underline">
                    {label}
                  </p>
                </a>
              );
            })}

            {hasHiddenSources && (
              <button
                type="button"
                onClick={handleToggleSources}
                className="flex min-w-[100px] cursor-pointer items-center justify-center rounded-md border border-border p-3 transition-colors hover:bg-surface-elevated"
                aria-expanded={showAllSources}
                aria-controls="source-list"
              >
                <span className="text-muted-foreground">
                  {showAllSources
                    ? "Show less"
                    : `+${sources.length - COLLAPSED_SOURCE_COUNT} sources`}
                </span>
              </button>
            )}
          </div>
        )}

        {providerLabel && (
          <div className="mt-2">
            <div className="inline-flex w-fit items-center gap-2 rounded-full bg-active-work/10 px-3 py-1 text-active-work">
              <span className="text-xs font-medium tracking-wide uppercase">Provider</span>
              <span className="text-xs font-medium">{providerLabel}</span>
            </div>
          </div>
        )}
      </div>

      {answer && (
        <div className={`text-muted-foreground ${embedded ? "mb-4" : "mb-6"}`}>
          <div className="prose text-muted-foreground dark:prose-invert">
            <MemoizedMarkdown>{answer}</MemoizedMarkdown>
          </div>
        </div>
      )}

      {similarQuestions.length > 0 && (
        <div className={embedded ? "mt-4" : "mt-8"} aria-labelledby="similar-questions-heading">
          <h2
            id="similar-questions-heading"
            className={`mb-3 font-medium text-muted-foreground ${embedded ? "text-sm" : "text-xl"}`}
          >
            People also ask
          </h2>
          <ul className="space-y-0">
            {similarQuestions.map((question, index) => (
              <li
                key={`question-${question}`}
                className={`border-t border-border py-4 ${
                  index === similarQuestions.length - 1 ? "border-b" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-muted-foreground">{question}</p>
                  {embedded && onToolInteraction && (
                    <Button
                      type="button"
                      variant="icon"
                      icon={<Sparkles />}
                      aria-label={`Use question "${question}" as a prompt`}
                      title="Use this question as a prompt"
                      onClick={() => {
                        void onToolInteraction?.(toolName, "useAsPrompt", {
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

      {completionId && !embedded && (
        <div className="mt-6">
          <Button
            variant="primary"
            onClick={() => {
              window.open(`/?completion_id=${completionId}`, "_blank");
            }}
            aria-label="Continue the conversation in a new window"
          >
            Continue the conversation
          </Button>
        </div>
      )}

      {providerWarning && (
        <div className="mt-6 rounded-md border border-attention/60 bg-attention/12 px-4 py-3 text-attention">
          {providerWarning}
        </div>
      )}
    </div>
  );
}
