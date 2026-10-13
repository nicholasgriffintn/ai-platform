import { ButtonLink, PageStatus, Skeleton } from "@ngriffin_uk/polychat-component-ui";
import { useBenchmarkIndex } from "@ngriffin_uk/polychat-library-react";
import type { BenchmarkBoard, BenchmarkId } from "@ngriffin_uk/polychat-schemas";
import { useState } from "react";

import { ARTIFICIAL_ANALYSIS_URL, benchmarkPaths, standingPosition } from "./benchmark-display.js";
import { BenchmarkCard } from "./BenchmarkCard.js";
import { ScatterPlot, type ScatterPoint } from "./charts/ScatterPlot.js";
import { MedalTable } from "./MedalTable.js";

function intelligencePoints(board: BenchmarkBoard): ScatterPoint[] {
  return board.standings.flatMap((standing) => {
    const intelligence = standing.artificialAnalysis?.intelligenceIndex;

    return standing.entrant.kind === "model" && typeof intelligence === "number"
      ? [
          {
            id: standing.runId,
            label: standing.entrant.name,
            x: intelligence,
            y: standingPosition(standing),
            highlight: standing.rank === 1,
          },
        ]
      : [];
  });
}

function CleverButCan({ boards }: { boards: readonly BenchmarkBoard[] }) {
  const [selected, setSelected] = useState<BenchmarkId>(boards[0]?.benchmark.id ?? "geoguess");
  const board = boards.find((candidate) => candidate.benchmark.id === selected) ?? boards[0];

  if (!board) {
    return null;
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-xl space-y-1">
          <h2 className="font-display text-2xl text-foreground">Does being clever help?</h2>
          <p className="text-sm text-muted-foreground">
            Each dot is a model. Across, its{" "}
            <a
              href={ARTIFICIAL_ANALYSIS_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="underline underline-offset-2"
            >
              Artificial Analysis
            </a>{" "}
            Intelligence Index. Up, how it did here.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Benchmark">
          {boards.map((candidate) => (
            <button
              key={candidate.benchmark.id}
              type="button"
              role="tab"
              aria-selected={candidate.benchmark.id === board.benchmark.id}
              onClick={() => setSelected(candidate.benchmark.id)}
              className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground aria-selected:border-accent-amber aria-selected:bg-accent-amber/10 aria-selected:text-foreground"
            >
              {candidate.benchmark.name}
            </button>
          ))}
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-surface p-4">
        <ScatterPlot
          points={intelligencePoints(board)}
          ariaLabel={`Artificial Analysis Intelligence Index against ${board.benchmark.name} score`}
          x={{
            label: "Artificial Analysis Intelligence Index",
            format: (value) => value.toFixed(0),
          }}
          y={{
            label: board.benchmark.scoring === "votes" ? "Win rate" : board.benchmark.name,
            format: (value) => `${Math.round(value * 100)}`,
          }}
          quadrants={{ topRight: "Clever and capable", bottomRight: "Clever, somehow lost" }}
        />
      </div>
    </section>
  );
}

export function BenchmarksIndex() {
  const { data, isLoading, error } = useBenchmarkIndex();

  return (
    <div className="mx-auto w-full max-w-6xl space-y-14 px-4 pb-16 sm:px-6">
      <header className="space-y-5 pt-2">
        <p className="polychat-eyebrow">Benchmarks</p>
        <h1 className="max-w-3xl font-display text-4xl font-medium tracking-tight text-balance text-foreground md:text-5xl">
          Sure it can do math, but can it find Lisbon from a kerb?
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Welcome to Polychat's benchmark arena. Here we test the latest models against a variety of
          challenges to see how they perform. Check the results yourself or see how you compare to
          the models.
        </p>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href={benchmarkPaths.app} variant="primary">
            Run your models
          </ButtonLink>
          <ButtonLink href={benchmarkPaths.board("geoguess")} variant="outline">
            Play GeoGuess
          </ButtonLink>
        </div>
      </header>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-64 rounded-2xl" />
          ))}
        </div>
      ) : null}

      {error ? (
        <PageStatus
          title="The boards are not loading"
          message="Something went wrong fetching the results. Try again in a moment."
        />
      ) : null}

      {data ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.boards.map((board) => (
              <BenchmarkCard key={board.benchmark.id} board={board} />
            ))}
          </section>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <CleverButCan boards={data.boards.filter((board) => board.standings.length > 0)} />
            <section className="space-y-4">
              <h2 className="font-display text-2xl text-foreground">Medal table</h2>
              <p className="text-sm text-muted-foreground">
                Podium places across every board. Ties share the step, so a crowded podium means the
                intervals overlap.
              </p>
              <MedalTable medals={data.medals} />
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
