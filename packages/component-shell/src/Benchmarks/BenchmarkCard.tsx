import { Badge, Link } from "@ngriffin_uk/polychat-component-ui";
import type { BenchmarkBoard } from "@ngriffin_uk/polychat-schemas";
import { ArrowUpRight } from "lucide-react";

import { benchmarkPaths, rankLabel, standingLabel } from "./benchmark-display.js";

const PODIUM = 3;

export function BenchmarkCard({ board }: { board: BenchmarkBoard }) {
  const { benchmark } = board;

  return (
    <Link
      href={benchmarkPaths.board(benchmark.id)}
      className="group flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-accent-amber/60"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
            {benchmark.category}
          </p>
          <h3 className="font-display text-2xl leading-tight text-foreground">{benchmark.name}</h3>
          <p className="text-sm text-muted-foreground">{benchmark.tagline}</p>
        </div>
        <ArrowUpRight
          size={18}
          className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          aria-hidden
        />
      </div>
      <ol className="space-y-1.5">
        {board.standings.slice(0, PODIUM).map((standing) => (
          <li key={standing.runId} className="flex items-baseline gap-3 text-sm">
            <span className="w-6 font-mono text-xs text-muted-foreground tabular-nums">
              {rankLabel(standing)}
            </span>
            <span className="min-w-0 flex-1 truncate text-foreground">{standing.entrant.name}</span>
            <span className="text-muted-foreground tabular-nums">
              {standingLabel(benchmark, standing)}
            </span>
          </li>
        ))}
        {board.standings.length === 0 ? (
          <li className="text-sm text-muted-foreground">Waiting for the first official runs.</li>
        ) : null}
      </ol>
      <div className="mt-auto flex flex-wrap gap-2">
        {benchmark.playable ? <Badge variant="info">You can play</Badge> : null}
        {benchmark.scoring === "votes" ? <Badge variant="warning">Voted</Badge> : null}
        {benchmark.decisionModels ? <Badge variant="outline">Decision models</Badge> : null}
        <Badge variant="outline">{board.standings.length} entrants</Badge>
      </div>
    </Link>
  );
}
