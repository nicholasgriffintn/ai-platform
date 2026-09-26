import { Badge, Button, cn } from "@ngriffin_uk/polychat-component-ui";
import type {
  DatasetProfile,
  ProviderCatalogueEntry,
  SizingEstimate,
  SpendSummary,
} from "@ngriffin_uk/polychat-schemas";
import {
  formatBytes,
  formatCompactCount,
  formatParameterCount,
  formatUsd,
} from "@ngriffin_uk/polychat-utility-core";
import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { StatTile } from "../Registry/OperationsPanels";

function counts(record: Record<string, number>): string {
  const entries = Object.entries(record).filter(([, value]) => value > 0);

  return entries.length === 0
    ? "none"
    : entries.map(([key, value]) => `${key} ${value}`).join(" · ");
}

export function DatasetProfilePanel({ profile }: { profile: DatasetProfile }) {
  const maxHistogram = Math.max(1, ...profile.lengthHistogram.map((bucket) => bucket.rows));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile
          label="Rows"
          value={formatCompactCount(profile.rows)}
          detail={`${profile.invalidRows} invalid`}
        />
        <StatTile
          label="Tokens"
          value={formatCompactCount(profile.tokens)}
          detail={`mean ${Math.round(profile.meanTokens)} · p95 ${Math.round(profile.p95Tokens)}`}
        />
        <StatTile
          label="Removed"
          value={formatCompactCount(profile.duplicatesRemoved + profile.decontaminatedRows)}
          detail={`${profile.duplicatesRemoved} duplicates · ${profile.decontaminatedRows} overlapping evals`}
        />
        <StatTile
          label="Flagged"
          value={formatCompactCount(profile.flaggedRows)}
          detail="for a human look"
        />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1 rounded-lg border border-border p-3 text-sm">
          <div className="text-xs text-muted-foreground uppercase">Splits</div>
          {profile.splits.map((split) => (
            <div key={split.name} className="flex justify-between tabular-nums">
              <span>{split.name}</span>
              <span>
                {formatCompactCount(split.rows)} rows · {formatCompactCount(split.tokens)} tok
              </span>
            </div>
          ))}
        </div>
        <div className="space-y-1 rounded-lg border border-border p-3 text-sm">
          <div className="text-xs text-muted-foreground uppercase">Personal data</div>
          <div>Found: {counts(profile.piiBefore)}</div>
          <div>Left after redaction: {counts(profile.piiAfter)}</div>
          <div className="text-muted-foreground">Languages: {counts(profile.languages)}</div>
        </div>
      </div>
      {profile.lengthHistogram.length > 0 && (
        <div className="rounded-lg border border-border p-3">
          <div className="mb-2 text-xs text-muted-foreground uppercase">Length in tokens</div>
          <div className="flex h-20 items-end gap-1">
            {profile.lengthHistogram.map((bucket) => (
              <div
                key={bucket.upTo}
                title={`≤ ${bucket.upTo}: ${bucket.rows} rows`}
                className="flex-1 rounded-t bg-active-work/60"
                style={{ height: `${Math.max(2, (bucket.rows / maxHistogram) * 100)}%` }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const SIZING_SEGMENTS = [
  { key: "weightBytes", label: "Weights", className: "bg-active-work" },
  { key: "kvBytes", label: "KV cache", className: "bg-attention" },
  { key: "overheadBytes", label: "Overhead", className: "bg-muted-foreground" },
] as const;

export function SizingPanel({ sizing }: { sizing: SizingEstimate }) {
  const total = Math.max(sizing.totalBytes, 1);

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium">
          Needs about {formatBytes(sizing.totalBytes, 1)} of accelerator memory
        </span>
        <span className="text-xs text-muted-foreground">
          {formatParameterCount(sizing.parameters)} parameters · {sizing.quantisation} ·{" "}
          {sizing.contextLength.toLocaleString("en-GB")} tokens × {sizing.concurrency} requests
        </span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-muted">
        {SIZING_SEGMENTS.map((segment) => (
          <div
            key={segment.key}
            className={segment.className}
            style={{ width: `${(sizing[segment.key] / total) * 100}%` }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {SIZING_SEGMENTS.map((segment) => (
          <span key={segment.key} className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${segment.className}`} />
            {segment.label} {formatBytes(sizing[segment.key], 1)}
          </span>
        ))}
        <span className="ml-auto">
          {sizing.basis === "config" ? "From the model config" : "Estimated from parameters alone"}
        </span>
      </div>
    </div>
  );
}

export function SpendSummaryPanel({ spend }: { spend: SpendSummary }) {
  const limit = spend.workspace.limitUsd;
  const used = spend.workspace.spentUsd + spend.workspace.committedUsd;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatTile label="Spent this month" value={formatUsd(spend.workspace.spentUsd)} />
        <StatTile
          label="Committed"
          value={formatUsd(spend.workspace.committedUsd)}
          detail="running jobs and replicas"
        />
        <StatTile
          label="Budget"
          value={limit === null ? "None" : formatUsd(limit)}
          detail={
            limit === null
              ? "set one under Governance"
              : `${Math.round((used / Math.max(limit, 0.01)) * 100)}% used`
          }
        />
      </div>
      {spend.bySubject.length > 0 && (
        <ul className="divide-y divide-border rounded-lg border border-border text-sm">
          {spend.bySubject.slice(0, 8).map((line) => (
            <li
              key={`${line.subjectType}:${line.subjectId}`}
              className="flex justify-between px-3 py-2"
            >
              <span>
                {line.name}{" "}
                <span className="text-xs text-muted-foreground">
                  {line.subjectType.replace("_", " ")}
                </span>
              </span>
              <span className="tabular-nums">{formatUsd(line.usd)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function providerAbilities(entry: ProviderCatalogueEntry): string[] {
  const { manifest } = entry;

  return [
    manifest.source ? "Model source" : null,
    manifest.store ? "Private storage" : null,
    manifest.trainers.length > 0 ? "Training" : null,
    manifest.hosts.length > 0 ? "Hosting" : null,
  ].filter((item): item is string => item !== null);
}

export function ProviderCatalogueList({
  providers,
  canManage,
  onConnect,
  onDisconnect,
}: {
  providers: readonly ProviderCatalogueEntry[];
  canManage: boolean;
  onConnect: (entry: ProviderCatalogueEntry) => void;
  onDisconnect: (entry: ProviderCatalogueEntry) => void;
}) {
  const ordered = [...providers].sort(
    (left, right) => Number(Boolean(right.connection)) - Number(Boolean(left.connection)),
  );

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {ordered.map((entry) => {
        const { manifest, connection } = entry;

        return (
          <div
            key={manifest.id}
            className={cn(
              "flex h-full flex-col gap-3 rounded-lg border p-4",
              connection ? "border-success/40" : "border-border",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="font-medium">{manifest.name}</div>
                <p className="text-xs text-muted-foreground">{manifest.description}</p>
              </div>
              {connection && <Badge variant="success">Connected</Badge>}
            </div>
            <div className="flex flex-wrap gap-1">
              {providerAbilities(entry).map((ability) => (
                <Badge key={ability} variant="secondary">
                  {ability}
                </Badge>
              ))}
            </div>
            {connection && (
              <p className="text-xs text-muted-foreground">
                {connection.account ?? "Account"} · can{" "}
                {Object.entries(connection.capabilities)
                  .filter(([, allowed]) => allowed)
                  .map(([capability]) => capability)
                  .join(", ") || "nothing yet"}
              </p>
            )}
            {canManage && (
              <div className="mt-auto flex items-center justify-end gap-2 border-t border-border pt-3">
                {connection && (
                  <Button size="sm" variant="ghost" onClick={() => onDisconnect(entry)}>
                    Disconnect
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => onConnect(entry)}>
                  {connection ? "Update" : "Connect"}
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function SpecView({ spec }: { spec: unknown }) {
  const [copied, setCopied] = useState(false);
  const text = JSON.stringify(spec, null, 2);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="relative">
      <Button
        size="sm"
        variant="ghost"
        className="absolute top-2 right-2"
        onClick={() => void copy()}
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </Button>
      <pre className="max-h-96 overflow-auto rounded-lg border border-border bg-muted/30 p-3 font-mono text-xs">
        {text}
      </pre>
    </div>
  );
}
