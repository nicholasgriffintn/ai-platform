import { cn } from "@ngriffin_uk/polychat-component-ui";
import { formatStatsDuration } from "@ngriffin_uk/polychat-library-chat";
import type { Delegation, DelegationState } from "@ngriffin_uk/polychat-schemas";

const stateLabels: Record<DelegationState, string> = {
  queued: "queued",
  running: "running",
  awaiting_input: "needs you",
  awaiting_approval: "needs you",
  done: "done",
  failed: "failed",
  cancelled: "cancelled",
  expired: "expired",
};

export interface DelegationCardProps {
  delegations: Delegation[];
  onStopAll?: () => void;
  onOpenDelegation?: (delegation: Delegation) => void;
}

export function DelegationCard({ delegations, onStopAll, onOpenDelegation }: DelegationCardProps) {
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
          <button type="button" className="text-xs text-failure" onClick={onStopAll}>
            Stop all
          </button>
        )}
      </header>
      <ul className="space-y-2">
        {delegations.map((delegation) => (
          <li key={delegation.id}>
            <button
              type="button"
              className="w-full text-left"
              onClick={() => onOpenDelegation?.(delegation)}
            >
              <div className="flex items-start justify-between gap-3 text-sm">
                <span className="font-medium text-foreground">{delegation.teammateId}</span>
                <span
                  className={cn(
                    "shrink-0 text-xs",
                    delegation.state === "failed" || delegation.state === "expired"
                      ? "text-failure"
                      : delegation.state === "done"
                        ? "text-success"
                        : "text-attention",
                  )}
                >
                  {stateLabels[delegation.state]}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{delegation.goal}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatStatsDuration(
                  Date.parse(delegation.updatedAt ?? new Date().toISOString()) -
                    Date.parse(delegation.createdAt),
                )}
              </p>
            </button>
          </li>
        ))}
      </ul>
      <footer className="text-xs text-muted-foreground">
        waiting for {first.waitFor} · deadline {new Date(first.budget.deadline).toLocaleString()}
      </footer>
    </section>
  );
}
