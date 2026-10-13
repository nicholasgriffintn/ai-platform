import { benchmarksService } from "@ngriffin_uk/polychat-library-client";
import type {
  BenchmarkId,
  BenchmarkPlayResult,
  BenchmarkPlayStart,
} from "@ngriffin_uk/polychat-schemas";
import { useCallback, useState } from "react";

export type PlayPhase = "idle" | "playing" | "scored";

function errorMessage(caught: unknown): string {
  return caught instanceof Error ? caught.message : "Something went wrong";
}

export function useBenchmarkPlay(benchmarkId: BenchmarkId) {
  const [game, setGame] = useState<BenchmarkPlayStart | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<BenchmarkPlayResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const phase: PlayPhase = result ? "scored" : game ? "playing" : "idle";

  const run = useCallback(async (operation: () => Promise<void>) => {
    setBusy(true);
    setError(null);

    try {
      await operation();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }, []);

  const start = useCallback(
    () =>
      run(async () => {
        setGame(await benchmarksService.play(benchmarkId));
        setAnswers({});
        setIndex(0);
        setResult(null);
      }),
    [benchmarkId, run],
  );

  const answer = useCallback((itemId: string, value: unknown) => {
    setAnswers((current) => ({ ...current, [itemId]: value }));
  }, []);

  const submit = useCallback(
    () =>
      run(async () => {
        if (!game) {
          return;
        }

        setResult(
          await benchmarksService.submitPlay({
            token: game.token,
            answers: game.items.map((item) => ({
              itemId: item.id,
              answer: answers[item.id] ?? null,
            })),
          }),
        );
      }),
    [answers, game, run],
  );

  const reset = useCallback(() => {
    setGame(null);
    setAnswers({});
    setIndex(0);
    setResult(null);
  }, []);

  return {
    phase,
    game,
    answers,
    index,
    setIndex,
    result,
    busy,
    error,
    start,
    answer,
    submit,
    reset,
  };
}
