import { Badge, Button } from "@ngriffin_uk/polychat-component-ui";
import type {
  LineageEdge,
  ModelDecision,
  ModelEvidence,
  ModelRoute,
  ModelVersionFile,
  PolicyVerdict,
} from "@ngriffin_uk/polychat-schemas";
import { formatBytes, shortenHash } from "@ngriffin_uk/polychat-utility-core";

import { DecisionStateBadge, EvidenceStatusDot, VerdictBadge } from "./RegistryBadges";
import { RegistryPanel } from "./RegistryPanel";

const EVIDENCE_LABELS: Record<ModelEvidence["kind"], string> = {
  licence: "Licence",
  format: "Weight format",
  remote_code: "Remote code",
  chat_template: "Chat template",
  hub_scan: "Hub scan",
  pickle_imports: "Pickle imports",
  gating: "Gating",
  card: "Card",
  signature: "Signature",
  eval: "Evaluation",
  public_eval: "Public score",
  dataset_stats: "Dataset",
  pii: "Personal data",
  residency: "Residency",
  drift: "Drift",
};

export function VerdictPanel({ verdict }: { verdict: PolicyVerdict }) {
  return (
    <RegistryPanel>
      {verdict.matches.length === 0 ? (
        <p className="text-sm text-muted-foreground">No rule applies. Nothing to see here.</p>
      ) : (
        <ul className="space-y-2">
          {verdict.matches.map((match) => (
            <li key={`${match.scope}:${match.ruleId}`} className="flex items-start gap-2 text-sm">
              <VerdictBadge effect={match.effect} className="mt-0.5" />
              <div>
                <div className="font-mono text-xs text-muted-foreground">
                  {match.scope} · {match.ruleId}
                </div>
                <p>{match.reason}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </RegistryPanel>
  );
}

export function EvidenceList({ evidence }: { evidence: readonly ModelEvidence[] }) {
  if (evidence.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No evidence yet. Inspection is on its way.</p>
    );
  }

  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {evidence.map((item) => (
        <li key={item.id} className="flex items-start gap-3 px-3 py-2">
          <EvidenceStatusDot status={item.status} className="mt-1.5" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">{EVIDENCE_LABELS[item.kind]}</span>
              {item.routeId && <Badge variant="outline">route</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">{item.summary}</p>
          </div>
          <div className="text-right font-mono text-[11px] text-muted-foreground">
            <div>{item.source}</div>
            <div>{new Date(item.observedAt).toLocaleDateString("en-GB")}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export interface DecisionListProps {
  decisions: ReadonlyArray<ModelDecision & { displayName?: string; revision?: string }>;
  canGovern: boolean;
  busyId?: string | null;
  onResolve?: (decision: ModelDecision, state: "approved" | "rejected" | "revoked") => void;
  onOpenVersion?: (versionId: string) => void;
}

export function DecisionList({
  decisions,
  canGovern,
  busyId,
  onResolve,
  onOpenVersion,
}: DecisionListProps) {
  if (decisions.length === 0) {
    return <p className="text-sm text-muted-foreground">No decisions yet.</p>;
  }

  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {decisions.map((decision) => (
        <li key={decision.id} className="flex flex-wrap items-center gap-3 px-3 py-3">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {decision.displayName && (
                <button
                  type="button"
                  className="font-medium text-foreground hover:underline"
                  onClick={() => onOpenVersion?.(decision.versionId)}
                >
                  {decision.displayName}
                  {decision.revision ? ` @ ${shortenHash(decision.revision)}` : ""}
                </button>
              )}
              <DecisionStateBadge state={decision.state} />
              <VerdictBadge effect={decision.verdict.effect} />
              {decision.isException && <Badge variant="destructive">Exception</Badge>}
              <Badge variant="outline">{decision.projectId ? "Project" : "Workspace"}</Badge>
              {decision.routeId && <Badge variant="outline">Route</Badge>}
            </div>
            {decision.note && <p className="text-sm text-muted-foreground">{decision.note}</p>}
            <p className="text-xs text-muted-foreground">
              Raised {new Date(decision.createdAt).toLocaleString("en-GB")}
              {decision.requestedBy === null ? " by the system" : ""}
              {decision.expiresAt
                ? ` · expires ${new Date(decision.expiresAt).toLocaleDateString("en-GB")}`
                : ""}
            </p>
          </div>
          {canGovern && onResolve && decision.state === "pending" && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="primary"
                disabled={busyId === decision.id}
                onClick={() => onResolve(decision, "approved")}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={busyId === decision.id}
                onClick={() => onResolve(decision, "rejected")}
              >
                Reject
              </Button>
            </div>
          )}
          {canGovern && onResolve && decision.state === "approved" && (
            <Button
              size="sm"
              variant="ghost"
              disabled={busyId === decision.id}
              onClick={() => onResolve(decision, "revoked")}
            >
              Revoke
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}

export interface RouteListProps {
  routes: ReadonlyArray<ModelRoute & { displayName?: string; approved?: boolean }>;
  canGovern: boolean;
  selectedRouteId?: string | null;
  onSelect?: (route: ModelRoute) => void;
  onRetire?: (route: ModelRoute) => void;
  onExportBom?: (route: ModelRoute) => void;
}

export function RouteList({
  routes,
  canGovern,
  selectedRouteId,
  onSelect,
  onRetire,
  onExportBom,
}: RouteListProps) {
  if (routes.length === 0) {
    return <p className="text-sm text-muted-foreground">No serving routes registered.</p>;
  }

  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {routes.map((route) => (
        <li
          key={route.id}
          className={`flex flex-wrap items-center gap-3 px-3 py-3 ${
            selectedRouteId === route.id ? "bg-muted/50" : ""
          }`}
        >
          <button
            type="button"
            className="min-w-0 flex-1 text-left"
            onClick={() => onSelect?.(route)}
            disabled={!onSelect}
          >
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">{route.displayName ?? route.providerModelId}</span>
              <Badge variant="outline">{route.provider}</Badge>
              <Badge variant="outline">{route.region}</Badge>
              {route.weightsVerified ? (
                <Badge variant="success">Dedicated weights</Badge>
              ) : (
                <Badge variant="warning">Weights unverified</Badge>
              )}
              {route.status === "retired" && <Badge variant="outline">Retired</Badge>}
              {route.approved !== undefined &&
                (route.approved ? (
                  <Badge variant="success">Approved here</Badge>
                ) : (
                  <Badge variant="warning">Not approved here</Badge>
                ))}
            </div>
            <div className="font-mono text-xs text-muted-foreground">{route.providerModelId}</div>
          </button>
          {onExportBom && (
            <Button size="sm" variant="ghost" onClick={() => onExportBom(route)}>
              ML-BOM
            </Button>
          )}
          {canGovern && onRetire && route.status === "active" && (
            <Button size="sm" variant="ghost" onClick={() => onRetire(route)}>
              Retire
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}

export function LineageList({
  lineage,
  versionId,
  names,
  onOpenVersion,
}: {
  lineage: readonly LineageEdge[];
  versionId: string;
  names: Record<string, string>;
  onOpenVersion: (versionId: string) => void;
}) {
  if (lineage.length === 0) {
    return <p className="text-sm text-muted-foreground">No recorded ancestors or descendants.</p>;
  }

  const relationLabel: Record<LineageEdge["relation"], string> = {
    fine_tuned_from: "fine-tuned from",
    trained_on: "trained on",
    evaluated_on: "evaluated on",
    quantised_from: "quantised from",
  };

  return (
    <ul className="space-y-2 text-sm">
      {lineage.map((edge) => {
        const other = edge.toVersionId === versionId ? edge.fromVersionId : edge.toVersionId;
        const outgoing = edge.fromVersionId === versionId;

        return (
          <li key={`${edge.fromVersionId}:${edge.toVersionId}:${edge.relation}`}>
            {outgoing ? "Parent of " : `${relationLabel[edge.relation]} `}
            <button
              type="button"
              className="font-medium text-active-work hover:underline"
              onClick={() => onOpenVersion(other)}
            >
              {names[other] ?? other}
            </button>
            {outgoing ? ` (${relationLabel[edge.relation]} this version)` : ""}
          </li>
        );
      })}
    </ul>
  );
}

export function FileList({ files }: { files: readonly ModelVersionFile[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="bg-muted/50 text-left text-xs text-muted-foreground uppercase">
          <tr>
            <th className="px-3 py-2 font-medium">Path</th>
            <th className="px-3 py-2 font-medium">Size</th>
            <th className="px-3 py-2 font-medium">SHA-256</th>
          </tr>
        </thead>
        <tbody>
          {files.map((file) => (
            <tr key={file.path} className="border-t border-border">
              <td className="px-3 py-1.5 font-mono text-xs">{file.path}</td>
              <td className="px-3 py-1.5 tabular-nums">{formatBytes(file.size, 1)}</td>
              <td className="px-3 py-1.5 font-mono text-xs text-muted-foreground">
                {file.sha256 ? shortenHash(file.sha256, 12) : "git object"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
