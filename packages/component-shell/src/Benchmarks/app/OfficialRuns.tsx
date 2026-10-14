import { ModelIcon } from "@ngriffin_uk/polychat-component-models";
import {
  Badge,
  Button,
  CardGridLoadingSkeleton,
  EmptyState,
  Link,
  cn,
} from "@ngriffin_uk/polychat-component-ui";
import {
  useCancelBenchmarkRun,
  useOfficialBenchmarkOverview,
  useQueueOfficialBenchmarkRuns,
  useRetryBenchmarkRun,
} from "@ngriffin_uk/polychat-library-react";
import {
  formatBenchmarkScore,
  type BenchmarkOfficialEntrant,
  type BenchmarkQueueResult,
  type BenchmarkSummary,
} from "@ngriffin_uk/polychat-schemas";
import { formatUsd } from "@ngriffin_uk/polychat-utility-core";
import { Play, RotateCcw, X } from "lucide-react";
import { useMemo, useState } from "react";

import { BLOCK_LINK_CLASS, CATEGORY_TONES } from "../benchmark-display.js";
import {
  OFFICIAL_FILTERS,
  OFFICIAL_STATUS_LABEL,
  countOfficialStatuses,
  failedModelIds,
  missingBenchmarkIds,
  officialModelRows,
  rowMatchesFilter,
  type OfficialCounts,
  type OfficialFilter,
  type OfficialModelRow,
} from "./official-runs.js";

const CELL_TONE: Record<BenchmarkOfficialEntrant["status"], string> = {
  missing: "border-dashed border-border text-muted-foreground",
  unavailable: "border-border bg-canvas/60 text-muted-foreground",
  ineligible: "border-border bg-canvas/60 text-muted-foreground",
  queued: "border-border bg-selection text-foreground",
  running: "border-active-work/40 bg-active-work/10 text-active-work",
  completed: "border-success/30 bg-success/10 text-foreground",
  failed: "border-failure/40 bg-failure/10 text-failure",
  cancelled: "border-dashed border-border text-muted-foreground",
};

function describeQueueResult(result: BenchmarkQueueResult): string {
  if (result.skippedForBudget) {
    return `Nothing queued: this month's budget is spent (${formatUsd(result.spentThisMonthUsd)}).`;
  }

  if (result.queued.length === 0) {
    return "Nothing to queue: every eligible model already has a run.";
  }

  const waiting = result.remaining > 0 ? ` ${result.remaining} more wait for the next pass.` : "";

  return `Queued ${result.queued.length} ${result.queued.length === 1 ? "run" : "runs"}.${waiting}`;
}

function BudgetBar({ spent, monthly }: { spent: number; monthly: number }) {
  const ratio = monthly === 0 ? 0 : Math.min(1, spent / monthly);

  return (
    <div className="min-w-56 space-y-1.5">
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="font-mono tracking-[0.12em] text-muted-foreground uppercase">
          This month
        </span>
        <span className="text-foreground tabular-nums">
          {formatUsd(spent)} of {formatUsd(monthly)}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-selection" aria-hidden>
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500",
            ratio >= 0.9 ? "bg-failure" : "bg-accent-amber",
          )}
          style={{ width: `${Math.round(ratio * 100)}%` }}
        />
      </div>
    </div>
  );
}

function Counts({ counts }: { counts: OfficialCounts }) {
  const entries: { label: string; value: number; tone: string }[] = [
    { label: "To run", value: counts.missing, tone: "text-foreground" },
    { label: "Queued", value: counts.queued, tone: "text-foreground" },
    { label: "Running", value: counts.running, tone: "text-active-work" },
    { label: "Failed", value: counts.failed, tone: "text-failure" },
    { label: "Finished", value: counts.completed, tone: "text-success" },
    { label: "Cannot run", value: counts.unavailable, tone: "text-muted-foreground" },
  ];

  return (
    <dl className="grid grid-cols-3 gap-x-6 gap-y-3 sm:grid-cols-6">
      {entries.map((entry) => (
        <div key={entry.label}>
          <dt className="font-mono text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
            {entry.label}
          </dt>
          <dd className={cn("font-display text-2xl tabular-nums", entry.tone)}>{entry.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Cell({
  entrant,
  benchmark,
  runHref,
  onQueue,
  onRetry,
  onCancel,
  busy,
}: {
  entrant: BenchmarkOfficialEntrant;
  benchmark: BenchmarkSummary;
  runHref: (runId: string) => string;
  onQueue: () => void;
  onRetry: (runId: string) => void;
  onCancel: (runId: string) => void;
  busy: boolean;
}) {
  const { run, status } = entrant;
  const base = cn(
    "flex min-h-14 w-full flex-col justify-center gap-0.5 rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors",
    CELL_TONE[status],
  );
  const title = entrant.reason ?? OFFICIAL_STATUS_LABEL[status];

  if (run && status === "completed" && run.score) {
    return (
      <Link
        href={runHref(run.id)}
        aria-label={`${entrant.name} on ${benchmark.name}: finished`}
        className={cn(BLOCK_LINK_CLASS, "block")}
        title={title}
      >
        <span className={cn(base, "hover:border-border-strong")}>
          <span className="font-display text-base text-foreground tabular-nums">
            {formatBenchmarkScore(benchmark, run.score.mean)}
          </span>
          <span className="text-muted-foreground tabular-nums">{formatUsd(run.usage.costUsd)}</span>
        </span>
      </Link>
    );
  }

  if (run && (status === "queued" || status === "running")) {
    const progress =
      run.itemsTotal === 0 ? 0 : Math.round((run.itemsCompleted / run.itemsTotal) * 100);

    return (
      <div className={base} title={title}>
        <span className="flex items-center justify-between gap-2">
          <Link href={runHref(run.id)} className="font-medium">
            {OFFICIAL_STATUS_LABEL[status]}
          </Link>
          <button
            type="button"
            aria-label={`Cancel ${entrant.name} on ${benchmark.name}`}
            disabled={busy}
            onClick={() => onCancel(run.id)}
            className="rounded p-0.5 text-muted-foreground hover:text-failure disabled:opacity-50"
          >
            <X size={12} aria-hidden />
          </button>
        </span>
        {status === "running" ? (
          <span className="flex items-center gap-2">
            <span className="h-1 flex-1 overflow-hidden rounded-full bg-selection" aria-hidden>
              <span
                className="block h-full rounded-full bg-active-work transition-[width] duration-500"
                style={{ width: `${progress}%` }}
              />
            </span>
            <span className="tabular-nums">
              {run.itemsCompleted}/{run.itemsTotal}
            </span>
          </span>
        ) : (
          <span className="text-muted-foreground">Waiting for a worker</span>
        )}
      </div>
    );
  }

  if (run && status === "failed") {
    return (
      <div className={base} title={title}>
        <span className="flex items-center justify-between gap-2">
          <Link href={runHref(run.id)} className="font-medium">
            Failed
          </Link>
          <button
            type="button"
            aria-label={`Retry ${entrant.name} on ${benchmark.name}`}
            disabled={busy || !entrant.credential}
            onClick={() => onRetry(run.id)}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <RotateCcw size={12} aria-hidden />
          </button>
        </span>
        <span className="line-clamp-1 text-muted-foreground">
          {run.itemsCompleted}/{run.itemsTotal} answered
        </span>
      </div>
    );
  }

  if (status === "missing" || status === "cancelled") {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={onQueue}
        title={title}
        className={cn(base, "items-start hover:border-border-strong hover:text-foreground")}
      >
        <span className="flex items-center gap-1 font-medium">
          <Play size={11} aria-hidden />
          Queue
        </span>
        <span className="text-muted-foreground">
          {status === "cancelled"
            ? "Cancelled"
            : entrant.credential === "byok"
              ? "Own key"
              : "Platform"}
        </span>
      </button>
    );
  }

  return (
    <div className={base} title={title}>
      <span className="font-medium">{OFFICIAL_STATUS_LABEL[status]}</span>
      <span className="line-clamp-1">{entrant.reason}</span>
    </div>
  );
}

function ModelRow({
  row,
  benchmarks,
  runHref,
  onQueue,
  onRetry,
  onCancel,
  busy,
}: {
  row: OfficialModelRow;
  benchmarks: readonly BenchmarkSummary[];
  runHref: (runId: string) => string;
  onQueue: (benchmarkIds: BenchmarkSummary["id"][], modelId: string) => void;
  onRetry: (runId: string) => void;
  onCancel: (runId: string) => void;
  busy: boolean;
}) {
  const missing = missingBenchmarkIds(row, benchmarks);

  return (
    <tr className="align-top">
      <th
        scope="row"
        className="sticky left-0 z-10 bg-surface py-2 pr-3 pl-4 text-left font-normal"
      >
        <div className="flex min-w-44 items-center gap-2.5">
          <ModelIcon modelName={row.name} provider={row.provider} size={18} />
          <div className="min-w-0">
            <p className="truncate text-sm text-foreground">{row.name}</p>
            <p className="truncate font-mono text-[10px] text-muted-foreground">{row.provider}</p>
          </div>
        </div>
        {missing.length > 1 ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onQueue(missing, row.modelId)}
            className="mt-1.5 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50"
          >
            Queue all {missing.length}
          </button>
        ) : null}
      </th>
      {benchmarks.map((benchmark) => {
        const entrant = row.cells.get(benchmark.id);

        return (
          <td key={benchmark.id} className="min-w-36 py-2 pr-2">
            {entrant ? (
              <Cell
                entrant={entrant}
                benchmark={benchmark}
                runHref={runHref}
                onQueue={() => onQueue([benchmark.id], row.modelId)}
                onRetry={onRetry}
                onCancel={onCancel}
                busy={busy}
              />
            ) : null}
          </td>
        );
      })}
    </tr>
  );
}

export function OfficialRuns({ runHref }: { runHref: (runId: string) => string }) {
  const overview = useOfficialBenchmarkOverview();
  const queue = useQueueOfficialBenchmarkRuns();
  const retry = useRetryBenchmarkRun();
  const cancel = useCancelBenchmarkRun();
  const [filter, setFilter] = useState<OfficialFilter>("all");
  const [notice, setNotice] = useState<string | null>(null);

  const rows = useMemo(
    () => (overview.data ? officialModelRows(overview.data) : []),
    [overview.data],
  );
  const counts = useMemo(
    () => (overview.data ? countOfficialStatuses(overview.data) : null),
    [overview.data],
  );

  if (overview.isLoading) {
    return <CardGridLoadingSkeleton count={2} label="Loading official runs" />;
  }

  if (overview.error || !overview.data || !counts) {
    return (
      <EmptyState
        title="Official runs unavailable"
        message={overview.error?.message ?? "Try again in a moment."}
      />
    );
  }

  const benchmarks = overview.data.boards.map((board) => board.benchmark);
  const visibleRows = rows.filter((row) => rowMatchesFilter(row, filter));
  const busy = queue.isPending || retry.isPending || cancel.isPending;
  const failed = failedModelIds(overview.data);
  const error = queue.error ?? retry.error ?? cancel.error;

  const runQueue = (request: Parameters<typeof queue.mutate>[0]) =>
    queue.mutate(request, { onSuccess: (result) => setNotice(describeQueueResult(result)) });

  return (
    <div className="space-y-6">
      <section className="space-y-5 rounded-2xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <Counts counts={counts} />
          <BudgetBar
            spent={overview.data.budget.spentThisMonthUsd}
            monthly={overview.data.budget.monthlyUsd}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="primary"
            size="sm"
            icon={<Play size={14} />}
            disabled={busy || counts.missing === 0}
            isLoading={queue.isPending}
            onClick={() => runQueue({})}
          >
            Queue everything to run
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            icon={<RotateCcw size={14} />}
            disabled={busy || failed.length === 0}
            onClick={() => runQueue({ modelIds: failed, retryFailed: true })}
          >
            Requeue failed
          </Button>
          <p className="text-xs text-muted-foreground">
            Runs you queue use your own keys where the platform has none. The nightly pass only uses
            platform keys.
          </p>
        </div>
        {notice ? <p className="text-sm text-foreground">{notice}</p> : null}
        {error ? <p className="text-sm text-failure">{error.message}</p> : null}
      </section>

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Show">
        {OFFICIAL_FILTERS.map((candidate) => (
          <button
            key={candidate.id}
            type="button"
            role="tab"
            aria-selected={candidate.id === filter}
            onClick={() => setFilter(candidate.id)}
            className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground aria-selected:border-accent-amber aria-selected:bg-accent-amber/10 aria-selected:text-foreground"
          >
            {candidate.label}
          </button>
        ))}
      </div>

      {visibleRows.length === 0 ? (
        <EmptyState title="Nothing here" message="No model matches that filter." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-surface py-2.5 pr-3 pl-4 font-mono text-[11px] font-normal tracking-wide text-muted-foreground uppercase">
                  Model
                </th>
                {benchmarks.map((benchmark) => (
                  <th
                    key={benchmark.id}
                    className="py-2.5 pr-2 font-mono text-[11px] font-normal tracking-wide text-muted-foreground uppercase"
                  >
                    <span className="flex items-center gap-1.5">
                      <span
                        aria-hidden
                        className={cn(
                          "size-1.5 rounded-full",
                          CATEGORY_TONES[benchmark.category].dot,
                        )}
                      />
                      {benchmark.name}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <ModelRow
                  key={row.modelId}
                  row={row}
                  benchmarks={benchmarks}
                  runHref={runHref}
                  onQueue={(benchmarkIds, modelId) =>
                    runQueue({ benchmarkIds, modelIds: [modelId] })
                  }
                  onRetry={(runId) => retry.mutate({ runId })}
                  onCancel={(runId) => cancel.mutate(runId)}
                  busy={busy}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        <Badge variant="outline">Sits out</Badge> means the model cannot play that benchmark, for
        instance a text-only model on GeoGuess. Finished cells link to the receipt.
      </p>
    </div>
  );
}
