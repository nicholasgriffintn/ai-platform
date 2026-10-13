import {
  BackLink,
  Badge,
  ButtonLink,
  PageStatus,
  Skeleton,
} from "@ngriffin_uk/polychat-component-ui";
import { useBenchmarkBoard } from "@ngriffin_uk/polychat-library-react";
import type { BenchmarkBoard, BenchmarkId } from "@ngriffin_uk/polychat-schemas";
import { formatUsd } from "@ngriffin_uk/polychat-utility-core";

import { Arena } from "./Arena.js";
import { benchmarkPaths, standingPosition } from "./benchmark-display.js";
import { ScatterPlot, type ScatterPoint } from "./charts/ScatterPlot.js";
import { Leaderboard } from "./Leaderboard.js";
import { PlayPanel } from "./play/PlayPanel.js";

function valuePoints(board: BenchmarkBoard): ScatterPoint[] {
  return board.standings.flatMap((standing) =>
    standing.costPerItemUsd && standing.costPerItemUsd > 0
      ? [
          {
            id: standing.runId,
            label: standing.entrant.name,
            x: standing.costPerItemUsd * board.benchmark.itemsPerPlay,
            y: standingPosition(standing),
            highlight: standing.rank === 1,
          },
        ]
      : [],
  );
}

function BoardBody({ board }: { board: BenchmarkBoard }) {
  const { benchmark } = board;

  return (
    <>
      <header className="space-y-4 pt-2">
        <BackLink href={benchmarkPaths.index} label="All benchmarks" />
        <p className="polychat-eyebrow">{benchmark.category}</p>
        <h1 className="font-display text-4xl font-medium tracking-tight text-balance text-foreground md:text-5xl">
          {benchmark.name}
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
          {benchmark.description}
        </p>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">Season {benchmark.version}</Badge>
          <Badge variant="outline">{benchmark.itemCount} items</Badge>
          {benchmark.decisionModels ? <Badge variant="info">Decision models welcome</Badge> : null}
        </div>
        <ButtonLink href={benchmarkPaths.app} variant="outline" size="sm">
          Run your own models
        </ButtonLink>
      </header>

      <section className="space-y-4">
        <h2 className="font-display text-2xl text-foreground">Leaderboard</h2>
        <Leaderboard board={board} />
        <p className="text-xs text-muted-foreground">
          Entrants share a rank when their 95% intervals overlap. AA intelligence is the Artificial
          Analysis Intelligence Index, shown with thanks and a link to the source.
        </p>
      </section>

      {benchmark.scoring === "votes" ? (
        <section className="space-y-4">
          <h2 className="font-display text-2xl text-foreground">Judge a pair</h2>
          <Arena benchmark={benchmark} />
        </section>
      ) : null}

      {benchmark.playable ? (
        <section className="space-y-4">
          <h2 className="font-display text-2xl text-foreground">Your turn</h2>
          <PlayPanel benchmark={benchmark} />
        </section>
      ) : null}

      <section className="space-y-4">
        <h2 className="font-display text-2xl text-foreground">Worth the money?</h2>
        <ScatterPlot
          points={valuePoints(board)}
          ariaLabel={`${benchmark.name} score against measured cost per game`}
          x={{
            label: `Measured cost for ${benchmark.itemsPerPlay} items (log scale)`,
            format: (value) => formatUsd(value),
            log: true,
          }}
          y={{
            label: benchmark.scoring === "votes" ? "Win rate" : "Score",
            format: (value) => `${Math.round(value * 100)}`,
          }}
          quadrants={{ topRight: "Good and dear", bottomRight: "Dear and disappointing" }}
        />
      </section>

      <section className="grid gap-6 rounded-2xl border border-border bg-surface p-5 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-2">
          <h2 className="font-display text-xl text-foreground">How it works</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{benchmark.method}</p>
        </div>
        {benchmark.credit ? (
          <div className="space-y-2">
            <h2 className="font-display text-xl text-foreground">Credit</h2>
            <a
              href={benchmark.credit.url}
              target="_blank"
              rel="noreferrer noopener"
              className="text-sm text-active-work underline underline-offset-2"
            >
              {benchmark.credit.label}
            </a>
          </div>
        ) : null}
      </section>
    </>
  );
}

export function BenchmarkBoardView({ benchmarkId }: { benchmarkId: BenchmarkId }) {
  const { data, isLoading, error } = useBenchmarkBoard(benchmarkId);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-12 px-4 pb-16 sm:px-6">
      {isLoading ? <Skeleton className="h-96 rounded-2xl" /> : null}
      {error ? (
        <PageStatus
          title="This board is not loading"
          message="Something went wrong fetching the results. Try again in a moment."
        />
      ) : null}
      {data ? <BoardBody board={data} /> : null}
    </div>
  );
}
