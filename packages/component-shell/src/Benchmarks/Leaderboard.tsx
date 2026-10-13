import { ModelIcon } from "@ngriffin_uk/polychat-component-models";
import { Link, cn } from "@ngriffin_uk/polychat-component-ui";
import type { BenchmarkBoard, BenchmarkStanding } from "@ngriffin_uk/polychat-schemas";
import { formatUsd } from "@ngriffin_uk/polychat-utility-core";
import { ExternalLink, Users } from "lucide-react";

import {
  ARTIFICIAL_ANALYSIS_URL,
  BLOCK_LINK_CLASS,
  benchmarkPaths,
  formatLatency,
  formatMetric,
  rankLabel,
  standingPosition,
  standingReadout,
} from "./benchmark-display.js";
import { IntervalBar } from "./charts/IntervalBar.js";

const PODIUM_CLASS: Record<number, string> = {
  1: "bg-accent-amber text-canvas",
  2: "bg-accent-slate text-canvas",
  3: "bg-accent-orange text-canvas",
};

const HEADER_CELL = "px-4 py-3 font-normal whitespace-nowrap";
const CELL = "px-4 py-3.5 align-middle";
const NUMERIC = "text-right text-sm text-muted-foreground tabular-nums";

function RankCell({ standing, isHuman }: { standing: BenchmarkStanding; isHuman: boolean }) {
  if (isHuman) {
    return <span className="font-mono text-sm text-muted-foreground">–</span>;
  }

  const podium = standing.tied ? undefined : PODIUM_CLASS[standing.rank];

  return (
    <span
      className={cn(
        "inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1.5 font-mono text-xs tabular-nums",
        podium ?? "text-muted-foreground",
      )}
    >
      {rankLabel(standing)}
    </span>
  );
}

function EntrantCell({ board, standing }: { board: BenchmarkBoard; standing: BenchmarkStanding }) {
  const entrant = standing.entrant;

  if (entrant.kind === "human") {
    return (
      <span className="flex items-center gap-2.5 font-medium text-foreground">
        <span className="flex size-6 items-center justify-center rounded-md bg-accent-amber/15">
          <Users size={14} className="text-accent-amber" aria-hidden />
        </span>
        {entrant.name}
      </span>
    );
  }

  const content = (
    <span className="flex min-w-0 items-center gap-2.5">
      {entrant.kind === "model" ? (
        <ModelIcon modelName={entrant.name} provider={entrant.provider} size={18} />
      ) : null}
      <span className="truncate font-medium text-foreground">{entrant.name}</span>
    </span>
  );

  return entrant.kind === "model" ? (
    <Link
      href={benchmarkPaths.entrant(board.benchmark.id, entrant.modelId)}
      className={cn("block min-w-0 rounded-md", BLOCK_LINK_CLASS, "hover:text-active-work")}
    >
      {content}
    </Link>
  ) : (
    content
  );
}

function ScoreCell({ board, standing }: { board: BenchmarkBoard; standing: BenchmarkStanding }) {
  const interval = standing.rating ? standing.rating.winRate : standing.score;
  const readout = standingReadout(board.benchmark, standing);
  const isHuman = standing.entrant.kind === "human";

  return (
    <div className="flex min-w-44 flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-foreground tabular-nums">{readout.primary}</span>
        {readout.secondary ? (
          <span className="truncate text-xs text-muted-foreground tabular-nums">
            {readout.secondary}
          </span>
        ) : null}
      </div>
      {interval ? (
        <IntervalBar
          mean={standingPosition(standing)}
          low={interval.low}
          high={interval.high}
          muted={isHuman}
        />
      ) : null}
    </div>
  );
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
  return (
    <tr
      className={cn(
        "transition-colors hover:bg-selection/40",
        isHuman && "bg-accent-amber/5 hover:bg-accent-amber/10",
      )}
    >
      <td className={cn(CELL, "w-12")}>
        <RankCell standing={standing} isHuman={isHuman} />
      </td>
      <td className={cn(CELL, "max-w-56")}>
        <EntrantCell board={board} standing={standing} />
      </td>
      <td className={CELL}>
        <ScoreCell board={board} standing={standing} />
      </td>
      {board.benchmark.metrics.map((metric) => (
        <td key={metric.key} className={cn(CELL, NUMERIC)}>
          {standing.metrics[metric.key] === undefined
            ? "–"
            : formatMetric(metric, standing.metrics[metric.key])}
        </td>
      ))}
      <td className={cn(CELL, NUMERIC)}>
        {standing.artificialAnalysis?.intelligenceIndex?.toFixed(0) ?? "–"}
      </td>
      <td className={cn(CELL, NUMERIC)}>
        {standing.costPerItemUsd === null ? "–" : formatUsd(standing.costPerItemUsd)}
      </td>
      <td className={cn(CELL, NUMERIC)}>{formatLatency(standing.latencyP50Ms)}</td>
    </tr>
  );
}

export function Leaderboard({ board }: { board: BenchmarkBoard }) {
  if (board.standings.length === 0 && !board.human) {
    return (
      <div className="rounded-2xl border border-dashed border-border px-6 py-10 text-center">
        <p className="font-display text-xl text-foreground">Nobody on the board yet</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          The daily queue will get the official entrants here. Until then you can run your own
          models and see where they would land.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left">
          <thead className="border-b border-border bg-canvas/40 font-mono text-[11px] tracking-[0.08em] text-muted-foreground uppercase">
            <tr>
              <th className={HEADER_CELL}>
                <span className="sr-only">Rank</span>
                <span aria-hidden>#</span>
              </th>
              <th className={HEADER_CELL}>Entrant</th>
              <th className={HEADER_CELL}>
                {board.benchmark.scoring === "votes"
                  ? "Rating, 95% interval"
                  : "Score, 95% interval"}
              </th>
              {board.benchmark.metrics.map((metric) => (
                <th key={metric.key} className={cn(HEADER_CELL, "text-right")}>
                  {metric.label}
                </th>
              ))}
              <th className={cn(HEADER_CELL, "text-right")}>
                <a
                  href={ARTIFICIAL_ANALYSIS_URL}
                  target="_blank"
                  rel="noreferrer noopener"
                  title="Artificial Analysis Intelligence Index"
                  className={cn(
                    "inline-flex items-center gap-1 hover:text-foreground",
                    BLOCK_LINK_CLASS,
                  )}
                >
                  AA index
                  <ExternalLink size={10} aria-hidden />
                </a>
              </th>
              <th className={cn(HEADER_CELL, "text-right")}>Cost / item</th>
              <th className={cn(HEADER_CELL, "text-right")}>Median time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {board.standings.map((standing) => (
              <Row key={standing.runId} board={board} standing={standing} />
            ))}
            {board.human ? <Row board={board} standing={board.human} isHuman /> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
