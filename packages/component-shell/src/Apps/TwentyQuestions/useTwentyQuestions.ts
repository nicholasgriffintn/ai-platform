import { twentyQuestionsService } from "@ngriffin_uk/polychat-library-client";
import type {
  TwentyQuestionsAnswer,
  TwentyQuestionsCategory,
  TwentyQuestionsGame,
} from "@ngriffin_uk/polychat-schemas";
import { useCallback, useState } from "react";

export type TwentyQuestionsPhase = "choosing" | "playing" | "won" | "lost";

export type AskedQuestion = TwentyQuestionsAnswer & { id: number };

export function countedQuestions(history: readonly TwentyQuestionsAnswer[]): number {
  return history.filter((answer) => answer.kind !== "unanswerable").length;
}

function errorMessage(caught: unknown): string {
  return caught instanceof Error ? caught.message : "Something went wrong";
}

export function useTwentyQuestions(projectId?: string) {
  const [game, setGame] = useState<TwentyQuestionsGame | null>(null);
  const [history, setHistory] = useState<AskedQuestion[]>([]);
  const [phase, setPhase] = useState<TwentyQuestionsPhase>("choosing");
  const [secret, setSecret] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    (category: TwentyQuestionsCategory) =>
      run(async () => {
        setGame(await twentyQuestionsService.start(category, projectId));
        setHistory([]);
        setSecret(null);
        setPhase("playing");
      }),
    [projectId, run],
  );

  const giveUp = useCallback(
    () =>
      run(async () => {
        if (!game) {
          return;
        }

        setSecret((await twentyQuestionsService.reveal(game.token, projectId)).secret);
        setPhase("lost");
      }),
    [game, projectId, run],
  );

  const ask = useCallback(
    (question: string) =>
      run(async () => {
        if (!game || phase !== "playing") {
          return;
        }

        const answer = await twentyQuestionsService.ask({ token: game.token, question }, projectId);
        const next = [...history, { ...answer, id: history.length }];

        setHistory(next);

        if (answer.solved) {
          setSecret(answer.secret);
          setPhase("won");
        } else if (countedQuestions(next) >= game.maxQuestions) {
          setSecret((await twentyQuestionsService.reveal(game.token, projectId)).secret);
          setPhase("lost");
        }
      }),
    [game, history, phase, projectId, run],
  );

  const reset = useCallback(() => {
    setGame(null);
    setHistory([]);
    setSecret(null);
    setPhase("choosing");
  }, []);

  return { game, history, phase, secret, busy, error, start, ask, giveUp, reset };
}
