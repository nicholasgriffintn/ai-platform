import { ModelIcon } from "@ngriffin_uk/polychat-component-models";
import { BackLink, Badge, cn } from "@ngriffin_uk/polychat-component-ui";
import {
  formatBenchmarkScore,
  type BenchmarkRun,
  type BenchmarkRunDetail,
} from "@ngriffin_uk/polychat-schemas";
import { formatUsd } from "@ngriffin_uk/polychat-utility-core";
import { Users } from "lucide-react";
import type { ReactNode } from "react";

import {
  CATEGORY_TONES,
  RUN_STATUS_LABEL,
  benchmarkPaths,
  formatLatency,
  formatMetric,
} from "./benchmark-display.js";
import { BenchmarkItems } from "./visualisers/BenchmarkItems.js";

function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="space-y-0.5">
      <p className="font-mono text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="text-lg text-foreground tabular-nums">{value}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function scopeLabel(run: BenchmarkRun): string {
  switch (run.scope) {
    case "official":
      return "Official run";
    case "human":
      return "Your game";
    case "workspace":
      return "Workspace run";
    default:
      return "Private run";
  }
}

function statusVariant(run: BenchmarkRun): "destructive" | "success" | "info" | "outline" {
  switch (run.status) {
    case "failed":
      return "destructive";
    case "completed":
      return "success";
    case "running":
      return "info";
    default:
      return "outline";
  }
}

function EntrantMark({ run }: { run: BenchmarkRun }) {
  if (run.entrant.kind === "human") {
    return (
      <span className="flex size-10 items-center justify-center rounded-xl bg-accent-amber/15">
        <Users size={20} className="text-accent-amber" aria-hidden />
      </span>
    );
  }

  if (run.entrant.kind === "model") {
    return (
      <span className="flex size-10 items-center justify-center rounded-xl border border-border bg-surface">
        <ModelIcon modelName={run.entrant.name} provider={run.entrant.provider} size={22} />
      </span>
    );
  }

  return null;
}

export function RunDetailView({
  detail,
  actions,
  embedded = false,
}: {
  detail: BenchmarkRunDetail;
  actions?: ReactNode;
  embedded?: boolean;
}) {
  const { benchmark, run } = detail;
  const tone = CATEGORY_TONES[benchmark.category];
  const isActive = run.status === "queued" || run.status === "running";
  const progress =
    run.itemsTotal === 0 ? 0 : Math.round((run.itemsCompleted / run.itemsTotal) * 100);

  return (
    <div
      className={cn("w-full space-y-10", embedded ? "" : "mx-auto max-w-6xl px-4 pb-16 sm:px-6")}
    >
      <header className="space-y-5 pt-2">
        {embedded ? null : (
          <BackLink href={benchmarkPaths.board(benchmark.id)} label={benchmark.name} />
        )}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <EntrantMark run={run} />
            <div className="min-w-0 space-y-2">
              <p className="flex items-center gap-2 font-mono text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
                <span aria-hidden className={cn("size-1.5 rounded-full", tone.dot)} />
                {scopeLabel(run)} · {benchmark.name}
              </p>
              <h1 className="font-display text-3xl font-medium tracking-tight text-foreground md:text-4xl">
                {run.entrant.name}
              </h1>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant={statusVariant(run)}>{RUN_STATUS_LABEL[run.status]}</Badge>
                <Badge variant="outline">Season {run.version}</Badge>
                {run.visibility === "link" ? <Badge variant="info">Shared by link</Badge> : null}
              </div>
            </div>
          </div>
          {actions}
        </div>
        {isActive ? (
          <div className="max-w-md space-y-1.5">
            <div className="h-1.5 overflow-hidden rounded-full bg-selection" aria-hidden>
              <div
                className="h-full rounded-full bg-accent-amber transition-[width] duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground tabular-nums">
              {run.itemsCompleted} of {run.itemsTotal} answered
            </p>
          </div>
        ) : null}
        {run.failureReason ? (
          <p className="rounded-xl border border-failure/30 bg-failure/5 px-4 py-3 text-sm text-failure">
            {run.failureReason}
          </p>
        ) : null}
      </header>

      <section className="grid grid-cols-2 gap-6 rounded-2xl border border-border bg-surface p-5 md:grid-cols-3 xl:grid-cols-6">
        <Stat
          label="Score"
          value={run.score ? formatBenchmarkScore(benchmark, run.score.mean) : "–"}
          hint={
            run.score
              ? `${formatBenchmarkScore(benchmark, run.score.low)} to ${formatBenchmarkScore(benchmark, run.score.high)}`
              : undefined
          }
        />
        <Stat
          label="Against the board"
          value={
            detail.officialRank === null
              ? "–"
              : `#${detail.officialRank} of ${detail.officialCount + 1}`
          }
          hint={detail.officialRank === null ? undefined : "If it joined the official board"}
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
          hint={`${run.usage.inputTokens.toLocaleString("en-GB")} in · ${run.usage.outputTokens.toLocaleString("en-GB")} out`}
        />
        <Stat label="Median time" value={formatLatency(run.usage.latencyP50Ms)} />
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="font-display text-2xl text-foreground">Every answer</h2>
          <p className="text-sm text-muted-foreground">
            The receipt. Each item, what came back, and how it was scored.
          </p>
        </div>
        <BenchmarkItems benchmark={benchmark} items={detail.items} entrantName={run.entrant.name} />
      </section>
    </div>
  );
}
