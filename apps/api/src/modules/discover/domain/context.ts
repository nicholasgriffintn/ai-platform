import type { DiscoverHealthSummary } from "@ngriffin_uk/polychat-schemas";
import type { PartOfDay } from "@ngriffin_uk/polychat-utility-core";

import type { DiscoverFeedbackSummary } from "./feedback";
import type { ResurfaceCandidate } from "./resurface";

export interface DiscoverContextSnapshot {
  date: string;
  weekday: string;
  partOfDay: PartOfDay;
  timezone: string;
  curate: string;
  followedTopics: readonly string[];
  chatTitles: readonly string[];
  memorySummary: string | null;
  feedback: DiscoverFeedbackSummary;
  recentCardTitles: readonly string[];
  waitingOnYou: ReadonlyArray<{ title: string; href: string }>;
  resurface: readonly ResurfaceCandidate[];
  health: DiscoverHealthSummary | null;
}

function minutesLine(label: string, minutes: number | null): string[] {
  if (minutes === null) {
    return [];
  }

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return [`${label}: ${hours > 0 ? `${hours}h ${rest}m` : `${rest} min`}`];
}

function section(title: string, lines: readonly string[], empty: string): string {
  return [`## ${title}`, ...(lines.length > 0 ? lines : [empty])].join("\n");
}

function bullets(values: readonly string[]): string[] {
  return values.map((value) => `- ${value}`);
}

export function describeDiscoverContext(snapshot: DiscoverContextSnapshot): string {
  return [
    `Today is ${snapshot.weekday} ${snapshot.date} (${snapshot.timezone}), ${snapshot.partOfDay}.`,
    section(
      "They asked for",
      snapshot.curate.trim() ? [snapshot.curate.trim()] : [],
      "Nothing specific.",
    ),
    section(
      "Topics they follow, so cover each with a fresh read link when there is news",
      bullets(snapshot.followedTopics),
      "None yet.",
    ),
    section(
      "Feedback on earlier editions",
      [
        ...bullets(snapshot.feedback.moreTopics.map((topic) => `More of: ${topic}`)),
        ...bullets(snapshot.feedback.lessTopics.map((topic) => `Less of: ${topic}`)),
        ...bullets(snapshot.feedback.hiddenTopics.map((topic) => `Never show: ${topic}`)),
        ...bullets(snapshot.feedback.saved.slice(0, 10).map((item) => `Saved: ${item.title}`)),
      ],
      "None yet.",
    ),
    section(
      "Recent chats, newest first",
      bullets(snapshot.chatTitles),
      "No recent chats. Lean on their request and broadly interesting news.",
    ),
    section(
      "What Poly remembers about them",
      snapshot.memorySummary ? [snapshot.memorySummary] : [],
      "Nothing, or memory is switched off.",
    ),
    section(
      "Waiting on them",
      bullets(snapshot.waitingOnYou.map((item) => `${item.title} (${item.href})`)),
      "Nothing.",
    ),
    section(
      "Their body yesterday, from Apple Health, for one gentle brief line only: never an interest, never advice",
      snapshot.health
        ? bullets([
            ...minutesLine("Sleep", snapshot.health.sleepMinutes),
            ...minutesLine("Mindful minutes", snapshot.health.mindfulMinutes),
            ...minutesLine("Exercise", snapshot.health.exerciseMinutes),
          ])
        : [],
      "Not shared.",
    ),
    section(
      "Worth resurfacing, for resurface cards with the link exactly as given",
      bullets(snapshot.resurface.map((item) => `${item.title}: ${item.detail} (${item.href})`)),
      "Nothing to resurface today.",
    ),
    section(
      "Already shown in recent editions, so leave these out",
      bullets(snapshot.recentCardTitles),
      "Nothing yet.",
    ),
  ].join("\n\n");
}
