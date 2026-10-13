import type { ModelBenchmarkStanding } from "@ngriffin_uk/polychat-schemas";
import { clampPercentage } from "@ngriffin_uk/polychat-utility-core";
import { ArrowUpRight } from "lucide-react";

const SHOWN = 3;

function standingHref(modelId: string, standing: ModelBenchmarkStanding): string {
  return standing.personal
    ? "/chat/apps/benchmarks"
    : `/benchmarks/${standing.benchmarkId}/models/${encodeURIComponent(modelId)}`;
}

function rankLabel(standing: ModelBenchmarkStanding): string {
  if (standing.rank === null) {
    return standing.personal ? "Your run" : "";
  }

  return standing.personal
    ? `Your run · would be #${standing.rank}`
    : `#${standing.rank} of ${standing.of}`;
}

export function BenchmarksPanel({
  modelId,
  standings,
}: {
  modelId: string;
  standings: readonly ModelBenchmarkStanding[];
}) {
  const shown = [...standings]
    .sort(
      (left, right) => Number(left.personal) - Number(right.personal) || right.ratio - left.ratio,
    )
    .slice(0, SHOWN);

  if (shown.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border/70 p-2.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-semibold text-muted-foreground">Polychat benchmarks</span>
      </div>
      <div className="grid gap-1.5">
        {shown.map((standing) => (
          <a
            key={`${standing.benchmarkId}-${String(standing.personal)}`}
            href={standingHref(modelId, standing)}
            aria-label={`${standing.name}: ${standing.display}`}
            className="rounded-md border border-border bg-surface px-2 py-1.5 transition-colors hover:border-border-strong hover:bg-selection/60"
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-muted-foreground">{standing.name}</span>
              <span className="text-[11px] font-semibold text-foreground tabular-nums">
                {standing.display}
              </span>
            </div>
            <div className="mb-1 h-1.5 overflow-hidden rounded-full bg-selection">
              <div
                className={
                  standing.personal
                    ? "h-full rounded-full bg-active-work"
                    : "h-full rounded-full bg-accent-amber"
                }
                style={{ width: `${clampPercentage(standing.ratio * 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground">{rankLabel(standing)}</span>
          </a>
        ))}
      </div>
      <a
        href="/benchmarks"
        className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
      >
        See all benchmarks
        <ArrowUpRight className="h-3 w-3" />
      </a>
    </div>
  );
}
