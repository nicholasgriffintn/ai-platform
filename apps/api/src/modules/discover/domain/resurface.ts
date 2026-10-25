import { DAY_MS, parseTimestamp } from "@ngriffin_uk/polychat-utility-core";

import type { DiscoverFeedbackEntry } from "./feedback";

const SAVED_MIN_AGE_DAYS = 7;
const SAVED_MAX_AGE_DAYS = 90;
const RESURFACE_LIMIT = 6;

export interface ResurfaceCandidate {
  title: string;
  detail: string;
  href: string;
}

export interface StudySetProgress {
  outputId: string;
  title: string;
  missed: number;
}

export function savedToRevisit(
  entries: readonly DiscoverFeedbackEntry[],
  now: number,
): ResurfaceCandidate[] {
  return entries.flatMap((entry) => {
    const age = (now - parseTimestamp(entry.createdAt).getTime()) / DAY_MS;

    return entry.signal === "saved" &&
      entry.url &&
      age >= SAVED_MIN_AGE_DAYS &&
      age <= SAVED_MAX_AGE_DAYS
      ? [{ title: entry.title, detail: "Something you saved a while ago", href: entry.url }]
      : [];
  });
}

export function missedFlashcards(sets: readonly StudySetProgress[]): ResurfaceCandidate[] {
  return sets.flatMap((set) =>
    set.missed > 0
      ? [
          {
            title: `${set.missed} ${set.missed === 1 ? "card" : "cards"} to revisit`,
            detail: set.title,
            href: `/chat/files/made/${encodeURIComponent(set.outputId)}`,
          },
        ]
      : [],
  );
}

export function collectResurfacing(
  ...groups: readonly ResurfaceCandidate[][]
): ResurfaceCandidate[] {
  return groups.flat().slice(0, RESURFACE_LIMIT);
}
