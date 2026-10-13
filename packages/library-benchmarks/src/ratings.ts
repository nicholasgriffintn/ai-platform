import { summariseScores } from "@ngriffin_uk/polychat-library-model-registry";
import type { BenchmarkRating, BenchmarkVoteWinner } from "@ngriffin_uk/polychat-schemas";

export interface PairwiseVote {
  left: string;
  right: string;
  winner: BenchmarkVoteWinner;
}

const BASE_RATING = 1000;
const RATING_SPREAD = 400;
const ITERATIONS = 200;
const PRIOR_GAMES = 1;

interface Tally {
  wins: number;
  losses: number;
  ties: number;
  outcomes: number[];
}

function tallyVotes(votes: readonly PairwiseVote[]): Map<string, Tally> {
  const tallies = new Map<string, Tally>();
  const tally = (key: string) => {
    const existing = tallies.get(key);

    if (existing) {
      return existing;
    }

    const created: Tally = { wins: 0, losses: 0, ties: 0, outcomes: [] };

    tallies.set(key, created);

    return created;
  };

  for (const vote of votes) {
    const left = tally(vote.left);
    const right = tally(vote.right);

    if (vote.winner === "tie") {
      left.ties += 1;
      right.ties += 1;
      left.outcomes.push(0.5);
      right.outcomes.push(0.5);
    } else {
      const [winner, loser] = vote.winner === "left" ? [left, right] : [right, left];

      winner.wins += 1;
      loser.losses += 1;
      winner.outcomes.push(1);
      loser.outcomes.push(0);
    }
  }

  return tallies;
}

export function fitBradleyTerry(votes: readonly PairwiseVote[]): Map<string, BenchmarkRating> {
  const tallies = tallyVotes(votes);
  const players = [...tallies.keys()];
  const strength = new Map(players.map((player) => [player, 1]));

  for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
    const next = new Map<string, number>();

    for (const player of players) {
      const record = tallies.get(player);

      if (!record) {
        continue;
      }

      const own = strength.get(player) ?? 1;
      let denominator = PRIOR_GAMES / (own + 1);

      for (const vote of votes) {
        if (vote.left === player || vote.right === player) {
          const opponent = vote.left === player ? vote.right : vote.left;

          denominator += 1 / (own + (strength.get(opponent) ?? 1));
        }
      }

      next.set(player, (record.wins + record.ties / 2 + PRIOR_GAMES / 2) / denominator);
    }

    for (const [player, value] of next) {
      strength.set(player, value);
    }
  }

  return new Map(
    players.map((player) => {
      const record = tallies.get(player) ?? { wins: 0, losses: 0, ties: 0, outcomes: [] };

      return [
        player,
        {
          rating: BASE_RATING + RATING_SPREAD * Math.log10(strength.get(player) ?? 1),
          wins: record.wins,
          losses: record.losses,
          ties: record.ties,
          winRate: summariseScores(record.outcomes),
        },
      ];
    }),
  );
}
