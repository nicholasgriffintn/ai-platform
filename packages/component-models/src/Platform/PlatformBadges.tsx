import { Badge } from "@ngriffin_uk/polychat-component-ui";
import type {
  DeploymentStatus,
  SpendPreflight,
  TrainingRunStatus,
} from "@ngriffin_uk/polychat-schemas";
import { formatUsd } from "@ngriffin_uk/polychat-utility-core";

type BadgeVariant = "success" | "warning" | "destructive" | "info" | "outline" | "secondary";

const RUN_STATUS: Record<TrainingRunStatus, { label: string; variant: BadgeVariant }> = {
  queued: { label: "Queued", variant: "outline" },
  preparing: { label: "Preparing", variant: "info" },
  submitted: { label: "Submitted", variant: "info" },
  running: { label: "Training", variant: "info" },
  completed: { label: "Completed", variant: "success" },
  failed: { label: "Failed", variant: "destructive" },
  cancelled: { label: "Cancelled", variant: "outline" },
};

const DEPLOYMENT_STATUS: Record<DeploymentStatus, { label: string; variant: BadgeVariant }> = {
  pending: { label: "Pending", variant: "outline" },
  provisioning: { label: "Provisioning", variant: "info" },
  running: { label: "Running", variant: "success" },
  scaled_to_zero: { label: "Asleep", variant: "secondary" },
  paused: { label: "Paused", variant: "outline" },
  updating: { label: "Updating", variant: "info" },
  failed: { label: "Failed", variant: "destructive" },
  deleting: { label: "Deleting", variant: "warning" },
  deleted: { label: "Deleted", variant: "outline" },
};

export function RunStatusBadge({ status }: { status: TrainingRunStatus }) {
  const { label, variant } = RUN_STATUS[status];

  return <Badge variant={variant}>{label}</Badge>;
}

export function DeploymentStatusBadge({ status }: { status: DeploymentStatus }) {
  const { label, variant } = DEPLOYMENT_STATUS[status];

  return <Badge variant={variant}>{label}</Badge>;
}

export function SpendPreflightNotice({ preflight }: { preflight: SpendPreflight }) {
  if (preflight.decision === "allow") {
    return (
      <p className="text-xs text-muted-foreground">
        Estimated {formatUsd(preflight.estimateUsd)}
        {preflight.remainingUsd === null
          ? ""
          : `, with ${formatUsd(preflight.remainingUsd)} left this month`}
        .
      </p>
    );
  }

  const tone =
    preflight.decision === "blocked"
      ? "border-failure/40 bg-failure/5 text-failure"
      : "border-attention/40 bg-attention/5 text-foreground";
  const lead =
    preflight.decision === "blocked"
      ? "Over budget."
      : preflight.decision === "needs_approval"
        ? "Needs spend approval."
        : "Close to budget.";

  return (
    <div className={`rounded-md border px-3 py-2 text-sm ${tone}`}>
      <span className="font-medium">{lead}</span> {preflight.reason ?? ""} Estimated{" "}
      {formatUsd(preflight.estimateUsd)}.
    </div>
  );
}
