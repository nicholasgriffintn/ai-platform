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
  completed: "bg-success/10 text-success border border-success/40",
  running: "bg-active-work/10 text-active-work border border-active-work/40",
  queued: "bg-active-work/10 text-active-work border border-active-work/40",
  processing: "bg-active-work/10 text-active-work border border-active-work/40",
  failed: "bg-failure/10 text-failure border border-failure/40",
  cancelled: "bg-failure/10 text-failure border border-failure/40",
  errored: "bg-failure/10 text-failure border border-failure/40",
  stopped: "bg-failure/10 text-failure border border-failure/40",
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
        <span className="rounded-full bg-active-work/10 text-active-work px-3 py-1">
          Provider: {providerLabel}
        </span>
        {run?.processor && (
          <span className="rounded-full bg-creative/10 text-creative px-3 py-1">
            Processor: {run.processor}
          </span>
        )}
        {normalizedStatus && (
          <span
            className={`rounded-full px-3 py-1 ${
              statusColors[normalizedStatus] ??
              "bg-selection text-muted-foreground border border-border"
            }`}
          >
            Status: {normalizedStatus}
          </span>
        )}
        {lastUpdatedAt && (
          <span className="bg-selection text-muted-foreground rounded-full px-3 py-1">
            Updated {lastUpdatedAt.toLocaleTimeString()}
          </span>
        )}
      </div>

      {shouldShowPollingNotice && !combinedError && (
        <div className="flex items-center gap-2 rounded-md border border-active-work/20 bg-active-work/5 px-4 py-3 text-sm text-active-work">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          <span>Research in progress. We&apos;ll keep this view updated.</span>
        </div>
      )}

      {combinedError && (
        <div
          role="alert"
          className="rounded-md border border-failure/40 bg-failure/10 px-4 py-3 text-sm text-failure"
        >
          {combinedError}
        </div>
      )}

      {Array.isArray(warnings) && warnings.length > 0 && (
        <div className="rounded-md border border-attention/60 bg-attention/12 text-attention px-4 py-3 text-sm">
          {warnings.join(" ")}
        </div>
      )}

      {typeof warnings === "string" && warnings && (
        <div className="rounded-md border border-attention/60 bg-attention/12 text-attention px-4 py-3 text-sm">
          {warnings}
        </div>
      )}

      {providerWarning && (
        <div className="rounded-md border border-attention/60 bg-attention/12 text-attention px-4 py-3 text-sm">
          {providerWarning}
        </div>
      )}

      {output && (
        <>
          {isTextContent ? (
            <div className="prose dark:prose-invert max-w-none text-foreground">
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
            <h2 className="text-lg font-semibold text-foreground">Evidence & Citations</h2>
            {evidenceCount > 4 && (
              <button
                type="button"
                className="text-xs font-medium text-active-work hover:text-active-work transition-colors"
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
                className="border-border bg-surface-elevated rounded-lg border p-4"
              >
                <div className="flex flex-wrap gap-2 items-center justify-between">
                  <p className="text-sm font-semibold text-active-work uppercase tracking-wide">
                    {item.field}
                  </p>
                  {item.confidence && (
                    <span className="text-xs text-muted-foreground">
                      Confidence: {item.confidence}
                    </span>
                  )}
                </div>

                {item.reasoning && (
                  <p className="mt-3 text-sm leading-relaxed text-foreground">{item.reasoning}</p>
                )}

                {item.citations && item.citations.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {item.citations.map((citation: ResearchCitation, citationIndex: number) => (
                      <li
                        key={`${item.field}-citation-${citationIndex}`}
                        className="border-border bg-surface rounded-md border p-3"
                      >
                        {citation.url ? (
                          <a
                            href={citation.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm font-medium text-active-work hover:text-active-work transition-colors"
                          >
                            {citation.title || extractHostname(citation.url)}
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : (
                          <span className="text-sm font-medium text-muted-foreground">
                            {citation.title || "Citation"}
                          </span>
                        )}
                        {citation.excerpts && citation.excerpts.length > 0 && (
                          <p className="mt-2 text-xs text-muted-foreground">
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
        <div className="space-y-3 text-xs text-muted-foreground">
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
