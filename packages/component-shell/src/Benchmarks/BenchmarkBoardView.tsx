import {
  BackLink,
  ButtonLink,
  PageStatus,
  SectionNav,
  Skeleton,
  cn,
} from "@ngriffin_uk/polychat-component-ui";
import { useBenchmarkBoard } from "@ngriffin_uk/polychat-library-react";
import type { BenchmarkBoard, BenchmarkId } from "@ngriffin_uk/polychat-schemas";
import { formatUsd } from "@ngriffin_uk/polychat-utility-core";
import { ExternalLink, FlaskConical, Gamepad2, Vote } from "lucide-react";
import type { ReactNode } from "react";

import { Arena } from "./Arena.js";
import {
  BLOCK_LINK_CLASS,
  CATEGORY_TONES,
  benchmarkPaths,
  scoringLabel,
  standingPosition,
} from "./benchmark-display.js";
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

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="font-mono text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-0.5 truncate text-base text-foreground tabular-nums">{value}</p>
    </div>
  );
}

function Section({
  id,
  title,
  lead,
  children,
}: {
  id: string;
  title: string;
  lead?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-4">
      <div className="space-y-1">
        <h2 className="font-display text-2xl text-foreground">{title}</h2>
        {lead ? <p className="max-w-2xl text-sm text-muted-foreground">{lead}</p> : null}
      </div>
      {children}
    </section>
  );
}

function BoardBody({ board }: { board: BenchmarkBoard }) {
  const { benchmark } = board;
  const tone = CATEGORY_TONES[benchmark.category];
  const sections = [
    { id: "leaderboard", label: "Leaderboard" },
    ...(benchmark.scoring === "votes" ? [{ id: "judge", label: "Judge a pair" }] : []),
    ...(benchmark.playable ? [{ id: "play", label: "Your turn" }] : []),
    { id: "value", label: "Worth the money?" },
    { id: "method", label: "How it works" },
  ];

  return (
    <>
      <header className="space-y-6 pt-2">
        <BackLink href={benchmarkPaths.index} label="All benchmarks" />
        <div className="space-y-4">
          <p className="flex items-center gap-2 font-mono text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
            <span aria-hidden className={cn("size-1.5 rounded-full", tone.dot)} />
            {benchmark.category}
          </p>
          <h1 className="font-display text-4xl font-medium tracking-tight text-balance text-foreground md:text-5xl">
            {benchmark.name}
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
            {benchmark.description}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-2xl border border-border bg-surface p-5 sm:grid-cols-4 lg:grid-cols-5">
          <Fact label="Entrants" value={board.standings.length} />
          <Fact label="Items" value={benchmark.itemCount} />
          <Fact label="Per game" value={benchmark.itemsPerPlay} />
          <Fact label="Scoring" value={scoringLabel(benchmark)} />
          <Fact label="Season" value={benchmark.version} />
        </div>
        <SectionNav label="On this page" sections={sections} />
      </header>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-12">
        <div className="min-w-0 space-y-12">
          <Section
            id="leaderboard"
            title="Leaderboard"
            lead="Entrants share a rank when their 95% intervals overlap. The AA index is the Artificial Analysis Intelligence Index, shown with thanks."
          >
            <Leaderboard board={board} />
          </Section>

          {benchmark.scoring === "votes" ? (
            <Section
              id="judge"
              title="Judge a pair"
              lead="Two blind entries, one vote. Ratings come from a Bradley–Terry fit over every vote cast."
            >
              <Arena benchmark={benchmark} />
            </Section>
          ) : null}

          {benchmark.playable ? (
            <Section
              id="play"
              title="Your turn"
              lead={`${benchmark.itemsPerPlay} rounds drawn from the same set the models faced. Your score joins the people's row.`}
            >
              <PlayPanel benchmark={benchmark} />
            </Section>
          ) : null}

          <Section
            id="value"
            title="Worth the money?"
            lead="Measured cost for one game against how the entrant did. Up and left is the bargain corner."
          >
            <div className="rounded-2xl border border-border bg-surface p-4">
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
            </div>
          </Section>

          <Section id="method" title="How it works">
            <div className="rounded-2xl border border-border bg-surface p-5">
              <p className="text-sm leading-relaxed text-muted-foreground">{benchmark.method}</p>
              {benchmark.credit ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  Dataset and inspiration:{" "}
                  <a
                    href={benchmark.credit.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 text-active-work"
                  >
                    {benchmark.credit.label}
                    <ExternalLink size={12} aria-hidden />
                  </a>
                </p>
              ) : null}
            </div>
          </Section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <div className="space-y-3 rounded-2xl border border-border bg-surface p-5">
            <FlaskConical size={20} className={tone.text} aria-hidden />
            <p className="font-display text-xl text-foreground">Run your own models</p>
            <p className="text-sm text-muted-foreground">
              Same items, same prompts, same scoring. Models on your own keys cost no credit and
              runs stay private until you share them.
            </p>
            <ButtonLink href={benchmarkPaths.app} variant="primary" size="sm">
              Open the Benchmarks app
            </ButtonLink>
          </div>
          {benchmark.playable ? (
            <a
              href="#play"
              className={cn(
                "flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-border-strong",
                BLOCK_LINK_CLASS,
              )}
            >
              <Gamepad2 size={18} className="text-active-work" aria-hidden />
              <span className="text-sm text-foreground">Play {benchmark.name} yourself</span>
            </a>
          ) : null}
          {benchmark.scoring === "votes" ? (
            <a
              href="#judge"
              className={cn(
                "flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-border-strong",
                BLOCK_LINK_CLASS,
              )}
            >
              <Vote size={18} className="text-attention" aria-hidden />
              <span className="text-sm text-foreground">Vote on a blind pair</span>
            </a>
          ) : null}
        </aside>
      </div>
    </>
  );
}

export function BenchmarkBoardView({ benchmarkId }: { benchmarkId: BenchmarkId }) {
  const { data, isLoading, error } = useBenchmarkBoard(benchmarkId);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-12 px-4 pb-16 sm:px-6">
      {isLoading ? (
        <div className="space-y-6 pt-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-12 w-2/3" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      ) : null}
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
