import { BackLink, Badge } from "@ngriffin_uk/polychat-component-ui";
import {
  formatBenchmarkScore,
  type BenchmarkRunDetail,
  type BenchmarkRunStatus,
} from "@ngriffin_uk/polychat-schemas";
import { formatUsd } from "@ngriffin_uk/polychat-utility-core";
import type { ReactNode } from "react";

import { benchmarkPaths, formatMetric } from "./benchmark-display.js";
import { BenchmarkItems } from "./visualisers/BenchmarkItems.js";

const STATUS_LABEL: Record<BenchmarkRunStatus, string> = {
  queued: "Queued",
  running: "Running",
  completed: "Finished",
  failed: "Failed",
  cancelled: "Cancelled",
};

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="font-mono text-[11px] tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="text-lg text-foreground tabular-nums">{value}</p>
    </div>
  );
}

export function RunDetailView({
  detail,
  actions,
}: {
  detail: BenchmarkRunDetail;
  actions?: ReactNode;
}) {
  const { benchmark, run } = detail;
  const isActive = run.status === "queued" || run.status === "running";

  return (
    <div className="mx-auto w-full max-w-6xl space-y-10 px-4 pb-16 sm:px-6">
      <header className="space-y-4 pt-2">
        <BackLink href={benchmarkPaths.board(benchmark.id)} label={benchmark.name} />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="polychat-eyebrow">
              {run.scope === "official"
                ? "Official run"
                : run.scope === "human"
                  ? "Your game"
                  : "Private run"}
            </p>
            <h1 className="font-display text-4xl font-medium tracking-tight text-foreground">
              {run.entrant.name}
            </h1>
            <div className="flex flex-wrap gap-2">
              <Badge variant={run.status === "failed" ? "destructive" : "outline"}>
                {STATUS_LABEL[run.status]}
              </Badge>
              <Badge variant="outline">Season {run.version}</Badge>
            </div>
          </div>
          {actions}
        </div>
        {isActive ? (
          <div className="max-w-md space-y-1">
            <div className="h-1.5 overflow-hidden rounded-full bg-selection" aria-hidden>
              <div
                className="h-full rounded-full bg-accent-amber transition-[width] duration-500"
                style={{
                  width: `${run.itemsTotal === 0 ? 0 : Math.round((run.itemsCompleted / run.itemsTotal) * 100)}%`,
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground tabular-nums">
              {run.itemsCompleted} of {run.itemsTotal} answered
            </p>
          </div>
        ) : null}
        {run.failureReason ? <p className="text-sm text-failure">{run.failureReason}</p> : null}
      </header>

      <section className="grid grid-cols-2 gap-6 rounded-2xl border border-border bg-surface p-5 md:grid-cols-4">
        <Stat
          label="Score"
          value={run.score ? formatBenchmarkScore(benchmark, run.score.mean) : "–"}
        />
        <Stat
          label="Against the board"
          value={
            detail.officialRank === null
              ? "–"
              : `#${detail.officialRank} of ${detail.officialCount + 1}`
          }
        />
        {benchmark.metrics.map((metric) => (
          <Stat
            key={metric.key}
            label={metric.label}
            value={
              run.metrics[metric.key] === undefined
                ? "–"
                : formatMetric(metric, run.metrics[metric.key])
            }
          />
        ))}
        <Stat
          label="Cost"
          value={run.usage.costUsd === null ? "Your keys" : formatUsd(run.usage.costUsd)}
        />
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-2xl text-foreground">Every answer</h2>
        <BenchmarkItems benchmark={benchmark} items={detail.items} entrantName={run.entrant.name} />
      </section>
    </div>
  );
}
