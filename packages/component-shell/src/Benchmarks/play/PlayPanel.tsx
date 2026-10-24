import { Button } from "@ngriffin_uk/polychat-component-ui";
import { useAuthStatus, useUIStore } from "@ngriffin_uk/polychat-library-react";
import { formatBenchmarkScore, type BenchmarkSummary } from "@ngriffin_uk/polychat-schemas";

import { BenchmarkItems } from "../visualisers/BenchmarkItems.js";
import { PlayAnswerInput } from "./PlayAnswerInput.js";
import { useBenchmarkPlay } from "./useBenchmarkPlay.js";

export function PlayPanel({ benchmark }: { benchmark: BenchmarkSummary }) {
  const { isAuthenticated } = useAuthStatus();
  const setShowLoginModal = useUIStore((state) => state.setShowLoginModal);
  const play = useBenchmarkPlay(benchmark.id);

  if (!isAuthenticated) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-5">
        <p className="max-w-xl text-sm text-muted-foreground">
          Think you can beat the models? Sign in and play {benchmark.itemsPerPlay} rounds. Your
          score joins the people's row on the board.
        </p>
        <Button type="button" variant="primary" onClick={() => setShowLoginModal(true)}>
          Sign in to play
        </Button>
      </div>
    );
  }

  if (play.phase === "idle") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-5">
        <p className="max-w-xl text-sm text-muted-foreground">
          {benchmark.itemsPerPlay} rounds drawn from the same set the models faced. No search, no
          peeking at the leaderboard.
        </p>
        <Button
          type="button"
          variant="primary"
          disabled={play.busy}
          onClick={() => void play.start()}
        >
          Play {benchmark.name}
        </Button>
        {play.error ? <p className="w-full text-sm text-failure">{play.error}</p> : null}
      </div>
    );
  }

  if (play.phase === "scored" && play.result) {
    const { run } = play.result;

    return (
      <div className="space-y-6 rounded-2xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-display text-3xl text-foreground">
              {run.score ? formatBenchmarkScore(benchmark, run.score.mean) : "No score"}
            </p>
            <p className="text-sm text-muted-foreground">
              {play.result.officialRank === null
                ? "No models on the board yet to compare with."
                : `That would place you #${play.result.officialRank} of ${play.result.officialCount + 1} on the board.`}
            </p>
          </div>
          <Button type="button" variant="outline" onClick={() => void play.start()}>
            Play again
          </Button>
        </div>
        <BenchmarkItems benchmark={benchmark} items={play.result.items} entrantName="You" />
      </div>
    );
  }

  const items = play.game?.items ?? [];
  const item = items[play.index];
  const isLast = play.index === items.length - 1;

  if (!item) {
    return null;
  }

  return (
    <div className="space-y-5 rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <p className="font-mono text-xs text-muted-foreground tabular-nums">
            Round {play.index + 1} of {items.length}
          </p>
          <ol className="flex gap-1" aria-hidden>
            {items.map((round, roundIndex) => (
              <li
                key={round.id}
                className={
                  roundIndex === play.index
                    ? "h-1.5 w-5 rounded-full bg-accent-amber"
                    : play.answers[round.id] !== undefined
                      ? "h-1.5 w-5 rounded-full bg-accent-amber/40"
                      : "h-1.5 w-5 rounded-full bg-selection"
                }
              />
            ))}
          </ol>
        </div>
        <Button type="button" variant="link" onClick={play.reset}>
          Give up
        </Button>
      </div>
      <PlayAnswerInput
        benchmarkId={benchmark.id}
        item={item}
        value={play.answers[item.id]}
        onChange={(value) => play.answer(item.id, value)}
      />
      <div className="flex flex-wrap justify-end gap-2">
        {play.index > 0 ? (
          <Button type="button" variant="outline" onClick={() => play.setIndex(play.index - 1)}>
            Back
          </Button>
        ) : null}
        {isLast ? (
          <Button
            type="button"
            variant="primary"
            disabled={play.busy}
            onClick={() => void play.submit()}
          >
            Score my game
          </Button>
        ) : (
          <Button type="button" variant="primary" onClick={() => play.setIndex(play.index + 1)}>
            Next
          </Button>
        )}
      </div>
      {play.error ? <p className="text-sm text-failure">{play.error}</p> : null}
    </div>
  );
}
