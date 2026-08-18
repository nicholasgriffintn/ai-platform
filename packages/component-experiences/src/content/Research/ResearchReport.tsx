import { JsonView, MemoizedMarkdown } from "@ngriffin_uk/polychat-component-content";
import { Button } from "@ngriffin_uk/polychat-component-ui";
import type {
  ResearchCitation,
  ResearchFieldBasis,
  ResearchOutput,
  ResearchRun,
} from "@ngriffin_uk/polychat-schemas";
import { ExternalLink, Loader2 } from "lucide-react";
import { useState } from "react";

const statusColors: Record<string, string> = {
  completed:
    "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300 border border-emerald-500/40",
  running:
    "bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300 border border-blue-500/40",
  queued:
    "bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300 border border-blue-500/40",
  processing:
    "bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300 border border-blue-500/40",
  failed:
    "bg-rose-500/10 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300 border border-rose-500/40",
  cancelled:
    "bg-rose-500/10 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300 border border-rose-500/40",
  errored:
    "bg-rose-500/10 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300 border border-rose-500/40",
  stopped:
    "bg-rose-500/10 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300 border border-rose-500/40",
};

function extractHostname(url?: string | null) {
  if (!url) {
    return "";
  }

  try {
    const parsed = new URL(url);

    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export interface ResearchReportProps {
  providerLabel: string;
  providerWarning?: string;
  run?: ResearchRun | null;
  output?: ResearchOutput | null;
  normalizedStatus?: string;
  lastUpdatedAt?: Date | null;
  warnings?: unknown;
  runId?: string | null;
  onContinueConversation?: () => void;
  errorMessage?: string | null;
  isPolling?: boolean;
  embedded?: boolean;
}

export function ResearchReport({
  providerLabel,
  providerWarning,
  run,
  output,
  normalizedStatus,
  lastUpdatedAt,
  warnings,
  runId,
  onContinueConversation,
  errorMessage,
  isPolling = false,
  embedded = false,
}: ResearchReportProps) {
  const [showAllEvidence, setShowAllEvidence] = useState(false);
  const combinedError = errorMessage ?? null;
  const shouldShowPollingNotice = isPolling;
  const evidence = Array.isArray(output?.basis) ? output.basis : [];
  const content = output?.content;
  const isTextContent = typeof content === "string";
  const evidenceCount = evidence.length;
  const displayedEvidence: ResearchFieldBasis[] = showAllEvidence ? evidence : evidence.slice(0, 4);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 text-xs font-medium uppercase tracking-wide">
        <span className="rounded-full bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300 px-3 py-1">
          Provider: {providerLabel}
        </span>
        {run?.processor && (
          <span className="rounded-full bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-300 px-3 py-1">
            Processor: {run.processor}
          </span>
        )}
        {normalizedStatus && (
          <span
            className={`rounded-full px-3 py-1 ${
              statusColors[normalizedStatus] ??
              "bg-zinc-500/10 text-zinc-600 dark:bg-zinc-500/20 dark:text-zinc-300 border border-zinc-500/30"
            }`}
          >
            Status: {normalizedStatus}
          </span>
        )}
        {lastUpdatedAt && (
          <span className="rounded-full bg-zinc-500/10 text-zinc-600 dark:bg-zinc-500/20 dark:text-zinc-300 px-3 py-1">
            Updated {lastUpdatedAt.toLocaleTimeString()}
          </span>
        )}
      </div>

      {shouldShowPollingNotice && !combinedError && (
        <div className="flex items-center gap-2 rounded-md border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-sm text-blue-600 dark:text-blue-300">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          <span>Research in progress. We&apos;ll keep this view updated.</span>
        </div>
      )}

      {combinedError && (
        <div className="rounded-md border border-red-600/40 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">
          {combinedError}
        </div>
      )}

      {Array.isArray(warnings) && warnings.length > 0 && (
        <div className="rounded-md border border-yellow-400/60 bg-yellow-50 dark:bg-yellow-500/10 text-yellow-800 dark:text-yellow-200 px-4 py-3 text-sm">
          {warnings.join(" ")}
        </div>
      )}

      {typeof warnings === "string" && warnings && (
        <div className="rounded-md border border-yellow-400/60 bg-yellow-50 dark:bg-yellow-500/10 text-yellow-800 dark:text-yellow-200 px-4 py-3 text-sm">
          {warnings}
        </div>
      )}

      {providerWarning && (
        <div className="rounded-md border border-yellow-400/60 bg-yellow-50 dark:bg-yellow-500/10 text-yellow-800 dark:text-yellow-200 px-4 py-3 text-sm">
          {providerWarning}
        </div>
      )}

      {output && (
        <>
          {isTextContent ? (
            <div className="prose dark:prose-invert max-w-none text-zinc-700 dark:text-zinc-200">
              <MemoizedMarkdown>{content}</MemoizedMarkdown>
            </div>
          ) : (
            <JsonView data={content ?? {}} />
          )}
        </>
      )}

      {output && evidenceCount > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-zinc-700 dark:text-zinc-200">
              Evidence & Citations
            </h2>
            {evidenceCount > 4 && (
              <button
                type="button"
                className="text-xs font-medium text-blue-500 hover:text-blue-400 transition-colors"
                onClick={() => setShowAllEvidence((prev) => !prev)}
              >
                {showAllEvidence ? "Show fewer citations" : `Show all ${evidenceCount} citations`}
              </button>
            )}
          </div>

          <div className="space-y-4">
            {displayedEvidence.map((item: ResearchFieldBasis, index: number) => (
              <div
                key={`${item.field}-${index}`}
                className="rounded-lg border border-zinc-700/30 dark:border-zinc-700/60 bg-zinc-900/5 dark:bg-zinc-900/30 p-4"
              >
                <div className="flex flex-wrap gap-2 items-center justify-between">
                  <p className="text-sm font-semibold text-blue-500 dark:text-blue-300 uppercase tracking-wide">
                    {item.field}
                  </p>
                  {item.confidence && (
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      Confidence: {item.confidence}
                    </span>
                  )}
                </div>

                {item.reasoning && (
                  <p className="mt-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">
                    {item.reasoning}
                  </p>
                )}

                {item.citations && item.citations.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {item.citations.map((citation: ResearchCitation, citationIndex: number) => (
                      <li
                        key={`${item.field}-citation-${citationIndex}`}
                        className="rounded-md border border-zinc-700/20 dark:border-zinc-700/40 bg-zinc-900/5 dark:bg-zinc-900/40 p-3"
                      >
                        {citation.url ? (
                          <a
                            href={citation.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm font-medium text-blue-500 hover:text-blue-400 transition-colors"
                          >
                            {citation.title || extractHostname(citation.url)}
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : (
                          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
                            {citation.title || "Citation"}
                          </span>
                        )}
                        {citation.excerpts && citation.excerpts.length > 0 && (
                          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                            {citation.excerpts[0]}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {runId && !embedded && (
        <div className="space-y-3 text-xs text-zinc-500 dark:text-zinc-400">
          <div>Task ID: {runId}</div>
          {normalizedStatus && <div>Status: {normalizedStatus}</div>}
        </div>
      )}

      {onContinueConversation && !embedded && (
        <div>
          <Button type="button" variant="secondary" onClick={onContinueConversation}>
            Continue the conversation
          </Button>
        </div>
      )}
    </div>
  );
}
