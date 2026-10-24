import { parseTimestamp, shiftCalendarDate } from "@ngriffin_uk/polychat-utility-core";

import type { DiscoverFeedbackEntry } from "./feedback";

const DAY_MS = 24 * 60 * 60 * 1000;
const SAVED_MIN_AGE_DAYS = 7;
const SAVED_MAX_AGE_DAYS = 90;
const YEAR_AGO_WINDOW_DAYS = 3;
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

export interface DatedConversation {
  id: string;
  title: string;
  createdAt: string;
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

export function aYearAgo(
  conversations: readonly DatedConversation[],
  today: string,
): ResurfaceCandidate[] {
  const from = shiftCalendarDate(today, -365 - YEAR_AGO_WINDOW_DAYS);
  const to = shiftCalendarDate(today, -365 + YEAR_AGO_WINDOW_DAYS);

  return conversations.flatMap((conversation) => {
    const day = conversation.createdAt.slice(0, 10);

    return conversation.title && day >= from && day <= to
      ? [
          {
            title: conversation.title,
            detail: "What you were working on a year ago",
            href: `/chat/${encodeURIComponent(conversation.id)}`,
          },
        ]
      : [];
  });
}

export function collectResurfacing(
  ...groups: readonly ResurfaceCandidate[][]
): ResurfaceCandidate[] {
  return groups.flat().slice(0, RESURFACE_LIMIT);
}
