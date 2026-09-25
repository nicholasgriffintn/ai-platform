import { Badge } from "@ngriffin_uk/polychat-component-ui";
import type { EvalRun, EvalSuite, ScoreSummary } from "@ngriffin_uk/polychat-schemas";

export interface ComparisonRoute {
  id: string;
  label: string;
  detail: string;
}

export interface EvalComparisonProps {
  suite: EvalSuite;
  runs: readonly EvalRun[];
  routes: readonly ComparisonRoute[];
  onOpenRun?: (run: EvalRun) => void;
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function latestRunsByRoute(runs: readonly EvalRun[]): Map<string, EvalRun> {
  const latest = new Map<string, EvalRun>();

  for (const run of runs) {
    if (run.trigger === "replay") {
      continue;
    }

    const existing = latest.get(run.routeId);

    if (!existing || existing.createdAt < run.createdAt) {
      latest.set(run.routeId, run);
    }
  }

  return latest;
}

function bestSeparated(scores: ScoreSummary[]): ScoreSummary | null {
  const sorted = [...scores].sort((left, right) => right.mean - left.mean);
  const [best, runnerUp] = sorted;

  if (!best) {
    return null;
  }

  return !runnerUp || best.low > runnerUp.high ? best : null;
}

export function EvalComparison({ suite, runs, routes, onOpenRun }: EvalComparisonProps) {
  const latest = latestRunsByRoute(runs);
  const metrics = suite.scorers.map((scorer) => scorer.metric);
  const rows = routes.flatMap((route) => {
    const run = latest.get(route.id);

    return run ? [{ route, run }] : [];
  });

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No runs yet. Pick some routes and run the suite.
      </p>
    );
  }

  const winners = Object.fromEntries(
    metrics.map((metric) => [
      metric,
      bestSeparated(rows.flatMap(({ run }) => (run.scores[metric] ? [run.scores[metric]] : []))),
    ]),
  );

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground uppercase">
            <tr>
              <th className="px-3 py-2 font-medium">Route</th>
              {metrics.map((metric) => (
                <th key={metric} className="px-3 py-2 font-medium">
                  {metric}
                </th>
              ))}
              <th className="px-3 py-2 font-medium">p95 latency</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ route, run }) => (
              <tr
                key={route.id}
                className="cursor-pointer border-t border-border hover:bg-muted/40"
                onClick={() => onOpenRun?.(run)}
              >
                <td className="px-3 py-2">
                  <div className="font-medium">{route.label}</div>
                  <div className="font-mono text-xs text-muted-foreground">{route.detail}</div>
                </td>
                {metrics.map((metric) => {
                  const score = run.scores[metric];
                  const isBest = score !== undefined && winners[metric] === score;

                  return (
                    <td key={metric} className="px-3 py-2 tabular-nums">
                      {score ? (
                        <div>
                          <span className={isBest ? "font-semibold text-active-work" : undefined}>
                            {percent(score.mean)}
                          </span>
                          <span className="ml-1 text-xs text-muted-foreground">
                            {percent(score.low)}–{percent(score.high)}
                          </span>
                          <div className="mt-1 h-1.5 w-full min-w-[60px] rounded bg-muted">
                            <div
                              className="h-1.5 rounded bg-active-work"
                              style={{ width: `${Math.round(score.mean * 100)}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  );
                })}
                <td className="px-3 py-2 tabular-nums">
                  {run.latencyP95Ms === null ? "—" : `${(run.latencyP95Ms / 1000).toFixed(1)}s`}
                </td>
                <td className="px-3 py-2">
                  {run.status === "completed" ? (
                    <Badge variant="success">n={run.casesTotal}</Badge>
                  ) : run.status === "failed" ? (
                    <Badge variant="destructive">Failed</Badge>
                  ) : (
                    <Badge variant="info">
                      {run.casesCompleted}/{run.casesTotal}
                    </Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Ranges are 95% intervals. A score is highlighted only when its interval clears the
        runner-up, so small gaps are left as the noise they are.
      </p>
    </div>
  );
}
