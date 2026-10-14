import { ModelIcon } from "@ngriffin_uk/polychat-component-models";
import {
  Badge,
  Card,
  CardGridLoadingSkeleton,
  EmptyState,
  Link,
  cn,
} from "@ngriffin_uk/polychat-component-ui";
import { useBenchmarkIndex, useMyBenchmarkRuns } from "@ngriffin_uk/polychat-library-react";
import {
  formatBenchmarkScore,
  type BenchmarkRun,
  type BenchmarkSummary,
} from "@ngriffin_uk/polychat-schemas";
import { Trophy } from "lucide-react";
import { useMemo } from "react";

import { BLOCK_LINK_CLASS, CATEGORY_TONES, RUN_STATUS_LABEL } from "../benchmark-display.js";

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

function RunCard({
  run,
  benchmark,
  href,
}: {
  run: BenchmarkRun;
  benchmark: BenchmarkSummary | undefined;
  href: string;
}) {
  const tone = benchmark ? CATEGORY_TONES[benchmark.category] : null;
  const isActive = run.status === "queued" || run.status === "running";
  const progress =
    run.itemsTotal === 0 ? 0 : Math.round((run.itemsCompleted / run.itemsTotal) * 100);

  return (
    <Link
      href={href}
      aria-label={`${run.entrant.name} on ${benchmark?.name ?? run.benchmarkId}`}
      className={cn("group", BLOCK_LINK_CLASS)}
    >
      <Card className="h-full gap-4 p-5 shadow-none transition-colors hover:border-border-strong">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {run.entrant.kind === "model" ? (
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface">
                <ModelIcon
                  modelName={run.entrant.name}
                  provider={run.entrant.provider}
                  size={18}
                  mono
                />
              </span>
            ) : null}
            <div className="min-w-0">
              <p className="truncate font-semibold text-foreground group-hover:underline">
                {run.entrant.name}
              </p>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {tone ? (
                  <span aria-hidden className={cn("size-1.5 rounded-full", tone.dot)} />
                ) : null}
                {benchmark?.name ?? run.benchmarkId}
              </p>
            </div>
          </div>
          <Badge variant={statusVariant(run)}>{RUN_STATUS_LABEL[run.status]}</Badge>
        </div>

        {isActive ? (
          <div className="space-y-1.5">
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
        ) : (
          <div className="space-y-1">
            <p className="font-display text-2xl text-foreground tabular-nums">
              {run.status === "completed" && run.score && benchmark
                ? formatBenchmarkScore(benchmark, run.score.mean)
                : "No score"}
            </p>
            {run.status === "completed" ? null : (
              <p className="text-xs text-muted-foreground tabular-nums">
                {run.itemsCompleted} of {run.itemsTotal} answered
              </p>
            )}
            {run.failureReason ? (
              <p className="line-clamp-2 text-xs text-failure">{run.failureReason}</p>
            ) : null}
          </div>
        )}

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{new Date(run.createdAt).toLocaleString("en-GB")}</span>
          {run.visibility !== "private" ? <Badge variant="info">Shared</Badge> : null}
        </div>
      </Card>
    </Link>
  );
}

export function MyRuns({ runHref }: { runHref: (runId: string) => string }) {
  const runs = useMyBenchmarkRuns();
  const index = useBenchmarkIndex();
  const summaries = useMemo(
    () => new Map((index.data?.boards ?? []).map((board) => [board.benchmark.id, board.benchmark])),
    [index.data],
  );

  if (runs.isLoading) {
    return <CardGridLoadingSkeleton count={3} label="Loading your runs" />;
  }

  if (runs.error) {
    return <EmptyState title="Runs unavailable" message={runs.error.message} />;
  }

  const list: BenchmarkRun[] = runs.data ?? [];

  if (list.length === 0) {
    return (
      <EmptyState
        icon={<Trophy size={24} className="text-muted-foreground" />}
        title="No runs yet"
        message="Pick a benchmark and a model above and let it have a go."
      />
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {list.map((run) => (
        <RunCard
          key={run.id}
          run={run}
          benchmark={summaries.get(run.benchmarkId)}
          href={runHref(run.id)}
        />
      ))}
    </div>
  );
}
