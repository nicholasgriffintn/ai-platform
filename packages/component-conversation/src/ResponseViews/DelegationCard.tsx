import { Badge, Button } from "@ngriffin_uk/polychat-component-ui";
import { formatStatsDuration } from "@ngriffin_uk/polychat-library-chat/response-stats";
import type {
  Delegation,
  DelegationOutputReference,
  DelegationState,
  DelegationTeammateReference,
} from "@ngriffin_uk/polychat-schemas";
import { isHttpUrl } from "@ngriffin_uk/polychat-utility-core";
import { ArrowUpRight, FileOutput } from "lucide-react";

const stateLabels: Record<DelegationState, string> = {
  queued: "queued",
  running: "running",
  awaiting_input: "needs you",
  awaiting_approval: "needs you",
  awaiting_takeover: "needs you",
  done: "done",
  failed: "failed",
  cancelled: "cancelled",
  expired: "expired",
};

const stateBadgeVariants: Record<
  DelegationState,
  "secondary" | "info" | "warning" | "success" | "destructive" | "outline"
> = {
  queued: "secondary",
  running: "info",
  awaiting_input: "warning",
  awaiting_approval: "warning",
  awaiting_takeover: "warning",
  done: "success",
  failed: "destructive",
  cancelled: "secondary",
  expired: "destructive",
};

export interface DelegationCardProps {
  delegations: Delegation[];
  teammates?: DelegationTeammateReference[];
  outputs?: DelegationOutputReference[];
  onStopAll?: () => void;
  onOpenDelegation?: (delegation: Delegation) => void;
  onResumeDelegation?: (delegation: Delegation) => void;
  onStartFreshDelegation?: (delegation: Delegation) => void;
  onOpenOutput?: (output: DelegationOutputReference) => void;
}

export function createDelegationFollowUpInteraction(
  delegation: Delegation,
  mode: "resume" | "fresh",
): {
  action: "resume" | "fresh";
  childConversationId: string;
  teammateId: string;
  input: string;
} {
  const instruction =
    mode === "resume"
      ? `Resume child conversation ${delegation.childConversationId} using continuation mode resume.`
      : `Start a fresh child conversation from the brief attached to ${delegation.childConversationId} using continuation mode fresh.`;

  return {
    action: mode,
    childConversationId: delegation.childConversationId,
    teammateId: delegation.teammateId,
    input: `Delegate follow-up work to teammate ${delegation.teammateId} with a new budget. ${instruction}`,
  };
}

export function DelegationCard({
  delegations,
  teammates = [],
  outputs = [],
  onStopAll,
  onOpenDelegation,
  onResumeDelegation,
  onStartFreshDelegation,
  onOpenOutput,
}: DelegationCardProps) {
  const first = delegations[0];

  if (!first) {
    return null;
  }

  const settled = delegations.every((delegation) =>
    ["done", "failed", "cancelled", "expired"].includes(delegation.state),
  );

  return (
    <section
      className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-3"
      aria-label="Delegated work"
    >
      <header className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Delegated · {delegations.length}
        </span>
        {!settled && onStopAll && (
          <Button type="button" size="xs" variant="destructive" onClick={onStopAll}>
            Stop all
          </Button>
        )}
      </header>
      <ul className="space-y-2">
        {delegations.map((delegation) => {
          const teammate = teammates.find((candidate) => candidate.id === delegation.teammateId);
          const canFollowUp = ["done", "failed", "cancelled", "expired"].includes(delegation.state);
          const resultOutputs = outputs.filter((output) =>
            delegation.result?.outputIds.includes(output.id),
          );
          const citations = (delegation.result?.citations ?? []).filter(isHttpUrl);

          return (
            <li
              key={delegation.id}
              className="rounded-md border border-border/60 bg-background/60 p-3"
            >
              <button
                type="button"
                className="w-full text-left"
                onClick={() => onOpenDelegation?.(delegation)}
              >
                <div className="flex items-start justify-between gap-3 text-sm">
                  <span className="font-medium text-foreground">
                    {teammate?.name ?? delegation.teammateId}
                  </span>
                  <Badge variant={stateBadgeVariants[delegation.state]}>
                    {stateLabels[delegation.state]}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{delegation.goal}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatStatsDuration(
                    Date.parse(delegation.updatedAt ?? new Date().toISOString()) -
                      Date.parse(delegation.createdAt),
                  )}
                </p>
              </button>
              {delegation.result && (
                <div className="mt-3 space-y-3 border-t border-border/60 pt-3">
                  <p className="line-clamp-5 text-sm whitespace-pre-wrap text-foreground">
                    {delegation.result.summary}
                  </p>
                  {(delegation.result.outstandingQuestions?.length ?? 0) > 0 && (
                    <div className="rounded-md border border-attention/30 bg-attention/5 p-2">
                      <p className="text-xs font-medium text-attention">Needs your input</p>
                      <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-foreground">
                        {delegation.result.outstandingQuestions?.map((question) => (
                          <li key={question.id}>{question.prompt}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {resultOutputs.length > 0 && (
                    <ul className="flex flex-wrap gap-2" aria-label="Delegation outputs">
                      {resultOutputs.map((output) => (
                        <li key={output.id}>
                          {onOpenOutput ? (
                            <button
                              type="button"
                              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-muted"
                              onClick={() => onOpenOutput(output)}
                            >
                              <FileOutput size={13} />
                              {output.title}
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-foreground">
                              <FileOutput size={13} />
                              {output.title}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {citations.length > 0 && (
                    <ul className="space-y-1" aria-label="Delegation evidence">
                      {citations.slice(0, 4).map((citation) => (
                        <li key={citation}>
                          <a
                            href={citation}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex max-w-full items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
                          >
                            <span className="truncate">{citation}</span>
                            <ArrowUpRight size={12} className="shrink-0" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {onOpenDelegation && (
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        onClick={() => onOpenDelegation(delegation)}
                      >
                        Continue conversation
                      </Button>
                    )}
                    {canFollowUp && onResumeDelegation && (
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        onClick={() => onResumeDelegation(delegation)}
                      >
                        Continue with new budget
                      </Button>
                    )}
                    {canFollowUp && onStartFreshDelegation && (
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        onClick={() => onStartFreshDelegation(delegation)}
                      >
                        Start fresh from brief
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <footer className="text-xs text-muted-foreground">
        waiting for {first.waitFor} · deadline {new Date(first.budget.deadline).toLocaleString()}
      </footer>
    </section>
  );
}
