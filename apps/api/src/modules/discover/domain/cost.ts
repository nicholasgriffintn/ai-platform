import {
  DISCOVER_EPISODE_MINUTES,
  type DiscoverEpisodeLength,
} from "@ngriffin_uk/polychat-schemas";

import { wordsForMinutes } from "./episodes";

const MATERIAL_TOKENS_PER_CALL = 7_000;
const OUTLINE_OUTPUT_TOKENS = 600;
const CHECK_OUTPUT_TOKENS = 200;
const SCRIPT_TOKENS_PER_WORD = 1.6;
const CHARACTERS_PER_WORD = 6;
const NEW_PICTURES_PER_MINUTE = 3.3;
const SEASON_PLAN_SHARE = 0.2;
const LISTEN_MINUTES = 4;
const LISTEN_MODEL_CALLS = 2;

export type PaidEpisodeLength = Exclude<DiscoverEpisodeLength, "off">;

export const PAID_EPISODE_LENGTHS: readonly PaidEpisodeLength[] = ["short", "standard", "long"];

export interface MediaUsagePlan {
  inputTokens: number;
  outputTokens: number;
  characters: number;
  images: number;
}

function chaptersFor(minutes: number): number {
  return Math.min(4, Math.max(2, Math.round(minutes / 4)));
}

export function episodeUsagePlan(length: PaidEpisodeLength): MediaUsagePlan {
  const minutes = DISCOVER_EPISODE_MINUTES[length];
  const words = wordsForMinutes(minutes);
  const chapters = chaptersFor(minutes);
  const modelCalls = 1 + chapters * 2.5 + SEASON_PLAN_SHARE;

  return {
    inputTokens: Math.round(modelCalls * MATERIAL_TOKENS_PER_CALL),
    outputTokens: Math.round(
      words * SCRIPT_TOKENS_PER_WORD + OUTLINE_OUTPUT_TOKENS + chapters * CHECK_OUTPUT_TOKENS,
    ),
    characters: words * CHARACTERS_PER_WORD,
    images: Math.ceil(minutes * NEW_PICTURES_PER_MINUTE),
  };
}

export function listenUsagePlan(): MediaUsagePlan {
  const words = wordsForMinutes(LISTEN_MINUTES);

  return {
    inputTokens: LISTEN_MODEL_CALLS * MATERIAL_TOKENS_PER_CALL,
    outputTokens: Math.round(words * SCRIPT_TOKENS_PER_WORD),
    characters: words * CHARACTERS_PER_WORD,
    images: 1,
  };
}

export function remainingCreditMicros(
  ledger: { creditMicros: number; capCreditMicros?: number | null } | null,
): number | null {
  return ledger?.capCreditMicros ? Math.max(0, ledger.capCreditMicros - ledger.creditMicros) : null;
}

export function pickAffordableLength(
  preferred: PaidEpisodeLength,
  costs: Readonly<Record<PaidEpisodeLength, number>>,
  remaining: number | null,
): PaidEpisodeLength | null {
  if (remaining === null) {
    return preferred;
  }

  const candidates = PAID_EPISODE_LENGTHS.slice(0, PAID_EPISODE_LENGTHS.indexOf(preferred) + 1);

  return [...candidates].reverse().find((length) => costs[length] <= remaining) ?? null;
}
