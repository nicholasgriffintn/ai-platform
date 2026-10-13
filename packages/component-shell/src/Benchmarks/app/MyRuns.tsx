import { Badge, Link } from "@ngriffin_uk/polychat-component-ui";
import { useBenchmarkIndex, useMyBenchmarkRuns } from "@ngriffin_uk/polychat-library-react";
import { formatBenchmarkScore, type BenchmarkRun } from "@ngriffin_uk/polychat-schemas";
import { useMemo } from "react";

export function MyRuns({ runHref }: { runHref: (runId: string) => string }) {
  const runs = useMyBenchmarkRuns();
  const index = useBenchmarkIndex();
  const summaries = useMemo(
    () => new Map((index.data?.boards ?? []).map((board) => [board.benchmark.id, board.benchmark])),
    [index.data],
  );

  if (runs.isLoading) {
    return <p className="text-sm text-muted-foreground">Fetching your runs…</p>;
  }

  const list: BenchmarkRun[] = runs.data?.runs ?? [];

  if (list.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
        No runs yet. Pick a benchmark and a model above and let it have a go.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
      {list.map((run) => {
        const benchmark = summaries.get(run.benchmarkId);

        return (
          <li key={run.id}>
            <Link
              href={runHref(run.id)}
              className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-selection/50"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {run.entrant.name}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {benchmark?.name ?? run.benchmarkId} ·{" "}
                  {new Date(run.createdAt).toLocaleString("en-GB")}
                </span>
              </span>
              {run.visibility !== "private" ? <Badge variant="info">Shared</Badge> : null}
              <span className="text-sm text-muted-foreground tabular-nums">
                {run.status === "completed" && run.score && benchmark
                  ? formatBenchmarkScore(benchmark, run.score.mean)
                  : run.status === "failed"
                    ? "Failed"
                    : `${run.itemsCompleted}/${run.itemsTotal}`}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
