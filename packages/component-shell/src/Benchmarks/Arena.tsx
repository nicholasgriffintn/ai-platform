import { Button, cn } from "@ngriffin_uk/polychat-component-ui";
import {
  useArenaPair,
  useArenaVote,
  useAuthStatus,
  useUIStore,
} from "@ngriffin_uk/polychat-library-react";
import type {
  BenchmarkSummary,
  BenchmarkVoteResult,
  BenchmarkVoteWinner,
} from "@ngriffin_uk/polychat-schemas";
import { Check, Vote } from "lucide-react";
import { useState } from "react";

import { ArtefactView } from "./visualisers/ArtefactView.js";

const SIDES = [
  { key: "left", label: "A" },
  { key: "right", label: "B" },
] as const;

export function Arena({ benchmark }: { benchmark: BenchmarkSummary }) {
  const { isAuthenticated } = useAuthStatus();
  const setShowLoginModal = useUIStore((state) => state.setShowLoginModal);
  const pair = useArenaPair(benchmark.id, isAuthenticated);
  const vote = useArenaVote();
  const [result, setResult] = useState<BenchmarkVoteResult | null>(null);

  if (!isAuthenticated) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-5">
        <div className="flex max-w-xl items-start gap-3">
          <Vote size={18} className="mt-0.5 shrink-0 text-attention" aria-hidden />
          <p className="text-sm text-muted-foreground">
            Votes decide this board. Sign in to judge blind pairs, one vote per pair per person, so
            nobody can stuff the ballot with their favourite hamster.
          </p>
        </div>
        <Button type="button" variant="primary" onClick={() => setShowLoginModal(true)}>
          Sign in to vote
        </Button>
      </div>
    );
  }

  const current = pair.data?.pair;

  if (pair.isLoading) {
    return (
      <div className="grid gap-4 rounded-2xl border border-border bg-surface p-5 md:grid-cols-2">
        <div className="aspect-square animate-pulse rounded-xl bg-selection" />
        <div className="aspect-square animate-pulse rounded-xl bg-selection" />
      </div>
    );
  }

  if (!current) {
    return (
      <div className="rounded-2xl border border-dashed border-border px-6 py-10 text-center">
        <p className="font-display text-xl text-foreground">Nothing to judge yet</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          Pairs appear once two entries have passed the checks. Check back after the next queue.
        </p>
      </div>
    );
  }

  const cast = (winner: BenchmarkVoteWinner) => {
    vote.mutate({ token: current.token, winner }, { onSuccess: setResult });
  };

  const next = () => {
    setResult(null);
    vote.reset();
    void pair.refetch();
  };

  return (
    <div className="space-y-5 rounded-2xl border border-border bg-surface p-5">
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">The brief. </span>
        {current.prompt}
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {SIDES.map((side) => {
          const won = result?.winner === side.key;
          const lost = result && result.winner !== "tie" && !won;

          return (
            <div
              key={side.key}
              className={cn(
                "space-y-3 rounded-xl border p-3 transition-colors",
                won ? "border-accent-amber/60 bg-accent-amber/5" : "border-border",
                lost && "opacity-70",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <span className="flex size-6 items-center justify-center rounded-md bg-selection font-mono text-xs">
                    {side.label}
                  </span>
                  {result ? result[side.key] : `Entry ${side.label}`}
                </p>
                {won ? <Check size={16} className="text-accent-amber" aria-hidden /> : null}
              </div>
              <ArtefactView artefact={current[side.key]} title={`Entry ${side.label}`} />
              {!result ? (
                <Button
                  type="button"
                  variant="outline"
                  fullWidth
                  disabled={vote.isPending}
                  onClick={() => cast(side.key)}
                >
                  {side.label} is better
                </Button>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {result ? (
          <>
            <p className="text-sm text-muted-foreground">
              {result.winner === "tie" ? "A draw, noted." : `You backed ${result[result.winner]}.`}
            </p>
            <Button type="button" variant="primary" onClick={next}>
              Next pair
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="outline"
              disabled={vote.isPending}
              onClick={() => cast("tie")}
            >
              Too close to call
            </Button>
            <Button type="button" variant="link" disabled={vote.isPending} onClick={next}>
              Skip this pair
            </Button>
          </>
        )}
        {vote.error ? <p className="w-full text-sm text-failure">{vote.error.message}</p> : null}
      </div>
    </div>
  );
}
