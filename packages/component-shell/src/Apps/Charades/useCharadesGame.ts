import { decisionsService } from "@ngriffin_uk/polychat-library-client";
import { blobToBase64DataUrl } from "@ngriffin_uk/polychat-library-realtime/media-encoding";
import { pickRandom } from "@ngriffin_uk/polychat-utility-core";
import { useCallback, useState } from "react";

import type { CharadesDeck } from "./decks.js";
import { buildCharadesRequest, judgeCharades, type CharadesVerdict } from "./judge.js";

export interface CharadesRound {
  id: number;
  card: string;
  verdict: CharadesVerdict;
}

function drawIndex(deck: CharadesDeck, played: readonly CharadesRound[]): number {
  const playedCards = new Set(played.map((round) => round.card));
  const fresh = deck.cards.flatMap((card, index) => (playedCards.has(card) ? [] : [index]));

  return pickRandom(fresh.length > 0 ? fresh : deck.cards.map((_, index) => index)) ?? 0;
}

export function useCharadesGame() {
  const [deck, setDeck] = useState<CharadesDeck | null>(null);
  const [cardIndex, setCardIndex] = useState(0);
  const [rounds, setRounds] = useState<CharadesRound[]>([]);
  const [verdict, setVerdict] = useState<CharadesVerdict | null>(null);
  const [judging, setJudging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chooseDeck = useCallback((next: CharadesDeck) => {
    setDeck(next);
    setRounds([]);
    setVerdict(null);
    setCardIndex(drawIndex(next, []));
  }, []);

  const nextCard = useCallback(() => {
    if (deck) {
      setVerdict(null);
      setCardIndex(drawIndex(deck, rounds));
    }
  }, [deck, rounds]);

  const judge = useCallback(
    async (clip: Blob) => {
      if (!deck) {
        return;
      }

      setJudging(true);
      setError(null);

      try {
        const video = await blobToBase64DataUrl(clip);
        const response = await decisionsService.decide(
          buildCharadesRequest(deck.cards, video, deck.name),
        );
        const result = judgeCharades(response, deck.cards, cardIndex);

        setVerdict(result);
        setRounds((current) => [
          ...current,
          { id: current.length, card: deck.cards[cardIndex] ?? "", verdict: result },
        ]);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "The judges have wandered off");
      } finally {
        setJudging(false);
      }
    },
    [cardIndex, deck],
  );

  return {
    deck,
    card: deck?.cards[cardIndex] ?? null,
    rounds,
    score: rounds.reduce((sum, round) => sum + round.verdict.points, 0),
    verdict,
    judging,
    error,
    chooseDeck,
    nextCard,
    judge,
    leaveDeck: () => setDeck(null),
  };
}
