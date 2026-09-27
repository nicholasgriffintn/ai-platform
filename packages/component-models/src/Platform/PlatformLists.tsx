import { Badge, Button, EmptyState } from "@ngriffin_uk/polychat-component-ui";
import type {
  AliasesResponse,
  DatasetSummary,
  DeploymentsResponse,
  SpendRequest,
  TrainingRunSummary,
  WorkspaceAuditRecord,
} from "@ngriffin_uk/polychat-schemas";
import {
  formatCompactCount,
  formatRelativeTime,
  formatUsd,
} from "@ngriffin_uk/polychat-utility-core";
import { Database, FlaskConical, Rocket, Tag } from "lucide-react";
import type { ReactNode } from "react";

import { UsabilityBadge, VerdictBadge } from "../Registry/RegistryBadges";
import { TRAINING_METHOD_LABELS } from "./labels";
import { DeploymentStatusBadge, RunStatusBadge } from "./PlatformBadges";
import { PlatformTable, PrimaryCell } from "./PlatformTable";

type DeploymentRow = DeploymentsResponse["deployments"][number];
type AliasRow = AliasesResponse["aliases"][number];

function emptyState(icon: ReactNode, title: string, message: string) {
  return <EmptyState icon={icon} title={title} message={message} className="min-h-[180px]" />;
}

export function DatasetList({
  datasets,
  onOpen,
}: {
  datasets: readonly DatasetSummary[];
  onOpen: (dataset: DatasetSummary) => void;
}) {
  return (
    <PlatformTable
      rows={datasets}
      rowKey={(dataset) => dataset.versionId}
      onOpen={onOpen}
      empty={emptyState(
        <Database size={28} />,
        "No datasets yet",
        "Upload a file, pull one from the Hub or a bucket, or build one from rated conversations.",
      )}
      columns={[
        {
          key: "name",
          label: "Dataset",
          render: (dataset) => (
            <PrimaryCell
              title={dataset.name}
              detail={
                dataset.profile
                  ? `${dataset.profile.collectionMethod} · ${dataset.profile.shape}`
                  : null
              }
            />
          ),
        },
        {
          key: "rows",
          label: "Rows",
          className: "tabular-nums",
          render: (dataset) =>
            dataset.profile?.status === "processing"
              ? "Processing…"
              : dataset.profile
                ? `${formatCompactCount(dataset.profile.rows)} · ${formatCompactCount(dataset.profile.tokens)} tok`
                : "—",
        },
        {
          key: "licence",
          label: "Licence and basis",
          render: (dataset) =>
            dataset.profile
              ? `${dataset.profile.governance.licence} · ${dataset.profile.governance.lawfulBasis}`
              : "—",
        },
        {
          key: "policy",
          label: "Policy",
          render: (dataset) => <VerdictBadge effect={dataset.verdict.effect} />,
        },
        {
          key: "standing",
          label: "Standing",
          render: (dataset) => <UsabilityBadge usable={dataset.usable} state={null} />,
        },
        {
          key: "used",
          label: "Used by",
          className: "tabular-nums",
          render: (dataset) => dataset.usedBy,
        },
      ]}
    />
  );
}

export function TrainingRunList({
  runs,
  onOpen,
}: {
  runs: readonly TrainingRunSummary[];
  onOpen: (run: TrainingRunSummary) => void;
}) {
  return (
    <PlatformTable
      rows={runs}
      rowKey={(run) => run.id}
      onOpen={onOpen}
      empty={emptyState(
        <FlaskConical size={28} />,
        "No training runs",
        "Pick a governed base and dataset, compare trainers on cost and fit, then start a run.",
      )}
      columns={[
        {
          key: "name",
          label: "Run",
          render: (run) => (
            <PrimaryCell title={run.spec.outputName} detail={`from ${run.baseName}`} />
          ),
        },
        {
          key: "method",
          label: "Method",
          render: (run) => (
            <span>
              {TRAINING_METHOD_LABELS[run.spec.method]}
              <span className="text-muted-foreground"> · {run.spec.adaptation}</span>
            </span>
          ),
        },
        {
          key: "where",
          label: "Where",
          render: (run) =>
            `${run.spec.target.provider} · ${run.spec.target.hardware ?? run.spec.target.target}`,
        },
        { key: "status", label: "Status", render: (run) => <RunStatusBadge status={run.status} /> },
        {
          key: "loss",
          label: "Loss",
          className: "tabular-nums",
          render: (run) => (run.latestLoss === null ? "—" : run.latestLoss.toFixed(3)),
        },
        {
          key: "cost",
          label: "Cost",
          className: "tabular-nums",
          render: (run) =>
            run.costUsd === null ? `≈ ${formatUsd(run.estimate.usd)}` : formatUsd(run.costUsd),
        },
        { key: "when", label: "Started", render: (run) => formatRelativeTime(run.createdAt) },
      ]}
    />
  );
}

export function DeploymentList({
  deployments,
  onOpen,
}: {
  deployments: readonly DeploymentRow[];
  onOpen: (deployment: DeploymentRow) => void;
}) {
  return (
    <PlatformTable
      rows={deployments}
      rowKey={(deployment) => deployment.id}
      onOpen={onOpen}
      empty={emptyState(
        <Rocket size={28} />,
        "Nothing deployed",
        "Size a governed model, compare hosts on fit, price and jurisdiction, then deploy it behind an alias.",
      )}
      columns={[
        {
          key: "name",
          label: "Deployment",
          render: (deployment) => (
            <PrimaryCell title={deployment.name} detail={deployment.displayName} />
          ),
        },
        {
          key: "host",
          label: "Host",
          render: (deployment) =>
            `${deployment.provider} · ${deployment.spec.target.hardware ?? deployment.host}`,
        },
        {
          key: "region",
          label: "Region",
          render: (deployment) =>
            deployment.jurisdiction ? (
              <Badge variant="outline">{deployment.jurisdiction.toUpperCase()}</Badge>
            ) : (
              "—"
            ),
        },
        {
          key: "status",
          label: "Status",
          render: (deployment) => <DeploymentStatusBadge status={deployment.status} />,
        },
        {
          key: "scale",
          label: "Replicas",
          className: "tabular-nums",
          render: (deployment) =>
            `${deployment.spec.scaling.minReplicas}–${deployment.spec.scaling.maxReplicas}`,
        },
        {
          key: "cost",
          label: "Hourly",
          className: "tabular-nums",
          render: (deployment) => formatUsd(deployment.hourlyUsd),
        },
      ]}
    />
  );
}

export function AliasList({
  aliases,
  onOpen,
}: {
  aliases: readonly AliasRow[];
  onOpen: (alias: AliasRow) => void;
}) {
  return (
    <PlatformTable
      rows={aliases}
      rowKey={(alias) => alias.id}
      onOpen={onOpen}
      empty={emptyState(
        <Tag size={28} />,
        "No aliases",
        "An alias is the stable name chat and apps call. Point it at a route, gate it on evals and promote safely.",
      )}
      columns={[
        {
          key: "name",
          label: "Alias",
          render: (alias) => <PrimaryCell title={alias.name} detail={alias.chatModelId} />,
        },
        { key: "target", label: "Serves", render: (alias) => alias.targetName ?? "Nothing yet" },
        {
          key: "canary",
          label: "Canary",
          render: (alias) => (alias.canaryRouteId ? `${alias.canaryPercent}%` : "—"),
        },
        {
          key: "gate",
          label: "Gate",
          render: (alias) =>
            alias.gate ? (
              <Badge variant="info">Eval gated</Badge>
            ) : (
              <Badge variant="outline">Ungated</Badge>
            ),
        },
        {
          key: "approval",
          label: "Approval",
          render: (alias) => (alias.requiresApproval ? "Required" : "—"),
        },
      ]}
    />
  );
}

export function SpendRequestList({
  requests,
  canResolve,
  onResolve,
}: {
  requests: readonly SpendRequest[];
  canResolve: boolean;
  onResolve: (request: SpendRequest, state: "approved" | "rejected") => void;
}) {
  return (
    <PlatformTable
      rows={requests}
      rowKey={(request) => request.id}
      empty={<p className="text-sm text-muted-foreground">No spend requests.</p>}
      columns={[
        {
          key: "summary",
          label: "Request",
          render: (request) => <PrimaryCell title={request.summary} detail={request.reason} />,
        },
        {
          key: "estimate",
          label: "Estimate",
          className: "tabular-nums",
          render: (request) => formatUsd(request.estimateUsd),
        },
        { key: "when", label: "Asked", render: (request) => formatRelativeTime(request.createdAt) },
        {
          key: "state",
          label: "State",
          render: (request) =>
            request.state === "pending" && canResolve ? (
              <span className="inline-flex justify-end gap-2">
                <Button size="xs" variant="ghost" onClick={() => onResolve(request, "rejected")}>
                  Reject
                </Button>
                <Button size="xs" variant="outline" onClick={() => onResolve(request, "approved")}>
                  Approve and start
                </Button>
              </span>
            ) : (
              <Badge
                variant={
                  request.state === "approved"
                    ? "success"
                    : request.state === "rejected" || request.state === "failed"
                      ? "destructive"
                      : "warning"
                }
              >
                {request.state}
              </Badge>
            ),
        },
      ]}
    />
  );
}

export function AuditList({ events }: { events: readonly WorkspaceAuditRecord[] }) {
  return (
    <PlatformTable
      rows={events}
      rowKey={(event) => event.id}
      minWidth={560}
      empty={<p className="text-sm text-muted-foreground">Nothing recorded yet.</p>}
      columns={[
        {
          key: "action",
          label: "Action",
          render: (event) => <span className="font-mono text-xs">{event.action}</span>,
        },
        {
          key: "target",
          label: "Target",
          render: (event) => (
            <span className="font-mono text-xs text-muted-foreground">
              {event.targetType}:{event.targetId ?? "—"}
            </span>
          ),
        },
        {
          key: "actor",
          label: "By",
          render: (event) => (event.actorUserId === null ? "System" : `#${event.actorUserId}`),
        },
        { key: "when", label: "When", render: (event) => formatRelativeTime(event.createdAt) },
      ]}
    />
  );
}
