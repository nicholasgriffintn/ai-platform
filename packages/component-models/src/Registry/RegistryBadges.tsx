import { Badge, cn } from "@ngriffin_uk/polychat-component-ui";
import type {
  EvidenceStatus,
  ModelDecisionState,
  PolicyEffect,
} from "@ngriffin_uk/polychat-schemas";

type BadgeVariant = "success" | "warning" | "destructive" | "info" | "outline" | "secondary";

const VERDICT_LABELS: Record<PolicyEffect, { label: string; variant: BadgeVariant }> = {
  allow: { label: "Clear", variant: "success" },
  warn: { label: "Warnings", variant: "info" },
  review: { label: "Needs review", variant: "warning" },
  block: { label: "Blocked", variant: "destructive" },
};

const DECISION_LABELS: Record<ModelDecisionState, { label: string; variant: BadgeVariant }> = {
  approved: { label: "Approved", variant: "success" },
  pending: { label: "In review", variant: "warning" },
  rejected: { label: "Rejected", variant: "destructive" },
  revoked: { label: "Revoked", variant: "outline" },
  expired: { label: "Expired", variant: "outline" },
};

const EVIDENCE_TONES: Record<EvidenceStatus, string> = {
  pass: "bg-success",
  warn: "bg-attention",
  fail: "bg-failure",
  unknown: "bg-active-work",
};

export function VerdictBadge({ effect, className }: { effect: PolicyEffect; className?: string }) {
  const { label, variant } = VERDICT_LABELS[effect];

  return (
    <Badge variant={variant} className={className}>
      {label}
    </Badge>
  );
}

export function DecisionStateBadge({ state }: { state: ModelDecisionState }) {
  const { label, variant } = DECISION_LABELS[state];

  return <Badge variant={variant}>{label}</Badge>;
}

export function UsabilityBadge({
  usable,
  state,
}: {
  usable: boolean;
  state: ModelDecisionState | null;
}) {
  if (usable) {
    return <Badge variant="success">Usable</Badge>;
  }

  return state ? (
    <DecisionStateBadge state={state} />
  ) : (
    <Badge variant="outline">Not requested</Badge>
  );
}

export function EvidenceStatusDot({
  status,
  className,
}: {
  status: EvidenceStatus;
  className?: string;
}) {
  return (
    <span
      aria-label={status}
      className={cn(
        "inline-block h-2.5 w-2.5 shrink-0 rounded-full",
        EVIDENCE_TONES[status],
        className,
      )}
    />
  );
}

export function SignalChips({
  signals,
}: {
  signals: ReadonlyArray<{ label: string; status: EvidenceStatus }>;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {signals.map((signal) => (
        <Badge
          key={signal.label}
          variant={
            signal.status === "pass"
              ? "success"
              : signal.status === "fail"
                ? "destructive"
                : signal.status === "warn"
                  ? "warning"
                  : "outline"
          }
        >
          {signal.label}
        </Badge>
      ))}
    </div>
  );
}
