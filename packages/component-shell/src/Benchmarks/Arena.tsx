import { Button } from "@ngriffin_uk/polychat-component-ui";
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
import { useState } from "react";

import { ArtefactView } from "./visualisers/ArtefactView.js";

export function Arena({ benchmark }: { benchmark: BenchmarkSummary }) {
  const { isAuthenticated } = useAuthStatus();
  const setShowLoginModal = useUIStore((state) => state.setShowLoginModal);
  const pair = useArenaPair(benchmark.id, isAuthenticated);
  const vote = useArenaVote();
  const [result, setResult] = useState<BenchmarkVoteResult | null>(null);

  if (!isAuthenticated) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-5">
        <p className="max-w-xl text-sm text-muted-foreground">
          Votes decide this board. Sign in to judge blind pairs, one vote per pair per person, so
          nobody can stuff the ballot with their favourite hamster.
        </p>
        <Button type="button" variant="primary" onClick={() => setShowLoginModal(true)}>
          Sign in to vote
        </Button>
      </div>
    );
  }

  const current = pair.data?.pair;

  if (pair.isLoading) {
    return <p className="text-sm text-muted-foreground">Fetching a pair…</p>;
  }

  if (!current) {
    return (
      <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
        Not enough finished entries to pit against each other yet.
      </p>
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
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{current.prompt}</p>
      <div className="grid gap-4 md:grid-cols-2">
        {(["left", "right"] as const).map((side) => (
          <div key={side} className="space-y-2">
            <ArtefactView
              artefact={current[side]}
              title={side === "left" ? "Entry A" : "Entry B"}
            />
            <p className="text-sm font-medium text-foreground">
              {result ? result[side] : side === "left" ? "Entry A" : "Entry B"}
            </p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
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
              onClick={() => cast("left")}
            >
              A is better
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={vote.isPending}
              onClick={() => cast("tie")}
            >
              Too close to call
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={vote.isPending}
              onClick={() => cast("right")}
            >
              B is better
            </Button>
            <Button type="button" variant="link" disabled={vote.isPending} onClick={next}>
              Skip
            </Button>
          </>
        )}
        {vote.error ? <p className="text-sm text-failure">{vote.error.message}</p> : null}
      </div>
    </div>
  );
}
