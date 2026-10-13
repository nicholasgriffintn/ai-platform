import { ModelIcon } from "@ngriffin_uk/polychat-component-models";
import { Link } from "@ngriffin_uk/polychat-component-ui";
import type { BenchmarkBoard, BenchmarkStanding } from "@ngriffin_uk/polychat-schemas";
import { formatUsd } from "@ngriffin_uk/polychat-utility-core";
import { Users } from "lucide-react";

import {
  ARTIFICIAL_ANALYSIS_URL,
  benchmarkPaths,
  formatMetric,
  rankLabel,
  standingLabel,
  standingPosition,
} from "./benchmark-display.js";
import { IntervalBar } from "./charts/IntervalBar.js";

function EntrantCell({ board, standing }: { board: BenchmarkBoard; standing: BenchmarkStanding }) {
  const entrant = standing.entrant;

  if (entrant.kind === "human") {
    return (
      <span className="flex items-center gap-2 font-medium text-foreground">
        <Users size={16} className="text-accent-amber" aria-hidden />
        {entrant.name}
      </span>
    );
  }

  const content = (
    <span className="flex min-w-0 items-center gap-2">
      {entrant.kind === "model" ? (
        <ModelIcon modelName={entrant.name} provider={entrant.provider} size={16} />
      ) : null}
      <span className="truncate font-medium text-foreground">{entrant.name}</span>
    </span>
  );

  return entrant.kind === "model" ? (
    <Link
      href={benchmarkPaths.entrant(board.benchmark.id, entrant.modelId)}
      className="min-w-0 hover:underline"
    >
      {content}
    </Link>
  ) : (
    content
  );
}

function scoreInterval(standing: BenchmarkStanding) {
  if (standing.rating) {
    return standing.rating.winRate;
  }

  return standing.score;
}

function Row({
  board,
  standing,
  isHuman = false,
}: {
  board: BenchmarkBoard;
  standing: BenchmarkStanding;
  isHuman?: boolean;
}) {
  const interval = scoreInterval(standing);

  return (
    <tr className={isHuman ? "bg-accent-amber/5" : undefined}>
      <td className="py-3 pr-3 font-mono text-sm text-muted-foreground tabular-nums">
        {isHuman ? "–" : rankLabel(standing)}
      </td>
      <td className="max-w-56 py-3 pr-4">
        <EntrantCell board={board} standing={standing} />
      </td>
      <td className="py-3 pr-4">
        <div className="flex min-w-40 flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground tabular-nums">
            {standingLabel(board.benchmark, standing)}
          </span>
          {interval ? (
            <IntervalBar
              mean={standingPosition(standing)}
              low={interval.low}
              high={interval.high}
              muted={isHuman}
            />
          ) : null}
        </div>
      </td>
      {board.benchmark.metrics.map((metric) => (
        <td key={metric.key} className="py-3 pr-4 text-sm text-muted-foreground tabular-nums">
          {standing.metrics[metric.key] === undefined
            ? "–"
            : formatMetric(metric, standing.metrics[metric.key])}
        </td>
      ))}
      <td className="py-3 pr-4 text-sm text-muted-foreground tabular-nums">
        {standing.artificialAnalysis?.intelligenceIndex?.toFixed(0) ?? "–"}
      </td>
      <td className="py-3 pr-4 text-sm text-muted-foreground tabular-nums">
        {standing.costPerItemUsd === null ? "–" : formatUsd(standing.costPerItemUsd)}
      </td>
      <td className="py-3 text-sm text-muted-foreground tabular-nums">
        {standing.latencyP50Ms === null ? "–" : `${(standing.latencyP50Ms / 1000).toFixed(1)}s`}
      </td>
    </tr>
  );
}

export function Leaderboard({ board }: { board: BenchmarkBoard }) {
  if (board.standings.length === 0 && !board.human) {
    return (
      <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
        No official runs yet. The daily queue will get to it, and you can run your own models in the
        meantime.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full min-w-[720px] text-left">
        <thead className="border-b border-border font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
          <tr>
            <th className="py-2.5 pr-3 pl-0 font-normal">#</th>
            <th className="py-2.5 pr-4 font-normal">Entrant</th>
            <th className="py-2.5 pr-4 font-normal">
              {board.benchmark.scoring === "votes" ? "Rating" : "Score, 95% interval"}
            </th>
            {board.benchmark.metrics.map((metric) => (
              <th key={metric.key} className="py-2.5 pr-4 font-normal">
                {metric.label}
              </th>
            ))}
            <th className="py-2.5 pr-4 font-normal">
              <a href={ARTIFICIAL_ANALYSIS_URL} target="_blank" rel="noreferrer noopener">
                AA intelligence
              </a>
            </th>
            <th className="py-2.5 pr-4 font-normal">Cost / item</th>
            <th className="py-2.5 font-normal">Median time</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border [&_td:first-child]:pl-4 [&_th:first-child]:pl-4">
          {board.standings.map((standing) => (
            <Row key={standing.runId} board={board} standing={standing} />
          ))}
          {board.human ? <Row board={board} standing={board.human} isHuman /> : null}
        </tbody>
      </table>
    </div>
  );
}
