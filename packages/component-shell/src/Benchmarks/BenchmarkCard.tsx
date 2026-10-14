import { ModelIcon } from "@ngriffin_uk/polychat-component-models";
import { Badge, Link, cn } from "@ngriffin_uk/polychat-component-ui";
import type { BenchmarkBoard, BenchmarkStanding } from "@ngriffin_uk/polychat-schemas";
import { ArrowUpRight, Gamepad2, Vote } from "lucide-react";

import {
  BLOCK_LINK_CLASS,
  CATEGORY_TONES,
  benchmarkPaths,
  rankLabel,
  standingReadout,
} from "./benchmark-display.js";

const PODIUM = 3;

function PodiumRow({ board, standing }: { board: BenchmarkBoard; standing: BenchmarkStanding }) {
  const readout = standingReadout(board.benchmark, standing);

  return (
    <li className="flex items-center gap-3 text-sm">
      <span className="w-5 shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
        {rankLabel(standing)}
      </span>
      {standing.entrant.kind === "model" ? (
        <ModelIcon
          modelName={standing.entrant.name}
          provider={standing.entrant.provider}
          size={14}
          mono
        />
      ) : null}
      <span className="min-w-0 flex-1 truncate text-foreground">{standing.entrant.name}</span>
      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{readout.primary}</span>
    </li>
  );
}

export function BenchmarkCard({ board }: { board: BenchmarkBoard }) {
  const { benchmark } = board;
  const tone = CATEGORY_TONES[benchmark.category];
  const podium = board.standings.slice(0, PODIUM);

  return (
    <Link
      href={benchmarkPaths.board(benchmark.id)}
      className={cn(
        "group relative flex h-full flex-col gap-5 overflow-hidden rounded-2xl border border-border bg-surface p-5 transition-[border-color,transform] duration-300 hover:-translate-y-0.5",
        tone.ring,
        BLOCK_LINK_CLASS,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100",
          tone.wash,
        )}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <p className="flex items-center gap-2 font-mono text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
            <span aria-hidden className={cn("size-1.5 rounded-full", tone.dot)} />
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

      {podium.length > 0 ? (
        <ol className="relative space-y-2 border-t border-border pt-4">
          {podium.map((standing) => (
            <PodiumRow key={standing.runId} board={board} standing={standing} />
          ))}
        </ol>
      ) : (
        <p className="relative border-t border-border pt-4 text-sm text-muted-foreground">
          Waiting for the first official runs.
        </p>
      )}

      <div className="relative mt-auto flex flex-wrap items-center gap-1.5">
        {benchmark.playable ? (
          <Badge variant="info">
            <Gamepad2 aria-hidden /> You can play
          </Badge>
        ) : null}
        {benchmark.scoring === "votes" ? (
          <Badge variant="warning">
            <Vote aria-hidden /> People vote
          </Badge>
        ) : null}
        {benchmark.decisionModels ? <Badge variant="outline">Decision models</Badge> : null}
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {board.standings.length === 1 ? "1 entrant" : `${board.standings.length} entrants`}
        </span>
      </div>
    </Link>
  );
}
