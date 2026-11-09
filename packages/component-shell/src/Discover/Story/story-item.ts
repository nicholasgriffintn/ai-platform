import type { ChatSuggestion } from "@ngriffin_uk/polychat-library-react";
import type {
  ConversationSubject,
  StoryArticle,
  StoryOutletCoverage,
  StorySummary,
  StoryVersion,
  StoryVersionHistory,
} from "@ngriffin_uk/polychat-schemas";
import {
  formatCount,
  formatRecentDay,
  formatRelativeTime,
  formatShortCalendarDate,
} from "@ngriffin_uk/polychat-utility-core";

import { discoverTopicGradient } from "../Edition/DiscoverTopicTile.js";
import type { DiscoverItemSummary } from "../Edition/item/useDiscoverItemSummary.js";

export interface StoryOutletRow {
  outlet: string;
  url: string | null;
  coverage: StoryOutletCoverage | undefined;
  angle: string | undefined;
}

export interface StoryTimelineEntry {
  version: number;
  date: string;
  change: string;
}

export function storyKicker(story: StorySummary): string {
  return story.status === "open"
    ? `Developing · ${formatCount(story.outletCount, "outlet")} · updated ${formatRelativeTime(story.lastArticleAt)}`
    : `Quiet since ${formatRecentDay(story.lastArticleAt)}`;
}

export function storySummary(
  story: StorySummary,
  subject: ConversationSubject,
): DiscoverItemSummary {
  return {
    title: story.title,
    kicker: storyKicker(story),
    art: {
      type: "image",
      background: discoverTopicGradient(story.topicKey ?? story.title),
      image: null,
    },
    subject,
  };
}

export function storySuggestions(storyId: string): ChatSuggestion[] {
  const suggestion = (key: string, label: string, prompt: string): ChatSuggestion => ({
    id: `discover-story-${storyId}-${key}`,
    label,
    prompt,
    category: "discover",
  });

  return [
    suggestion("matters", "What matters here?", "What matters in this story, in three lines?"),
    suggestion(
      "differ",
      "Where do outlets differ?",
      "Where do the outlets covering this story differ, and why might that be?",
    ),
    suggestion(
      "before",
      "What came before?",
      "What happened before this story that I need to know to follow it?",
    ),
  ];
}

export function storyTimeline(history: readonly StoryVersionHistory[]): StoryTimelineEntry[] {
  return [...history]
    .sort((left, right) => right.version - left.version)
    .flatMap((entry) => {
      const change = entry.overview[0];

      return change
        ? [
            {
              version: entry.version,
              date: formatShortCalendarDate(entry.writtenAt.slice(0, 10)),
              change,
            },
          ]
        : [];
    });
}

export function storyOutletRows(
  coverage: readonly StoryOutletCoverage[],
  angles: StoryVersion["outlets"],
  articles: readonly StoryArticle[],
): StoryOutletRow[] {
  const angleBySource = new Map(angles.map((entry) => [entry.source, entry.angle]));
  const urlByOutlet = new Map<string, string>();

  for (const article of articles) {
    if (!urlByOutlet.has(article.outlet)) {
      urlByOutlet.set(article.outlet, article.url);
    }
  }

  const covered = new Set(coverage.map((entry) => entry.outlet));

  return [
    ...coverage.map((entry) => ({
      outlet: entry.outlet,
      url: urlByOutlet.get(entry.outlet) ?? null,
      coverage: entry,
      angle: angleBySource.get(entry.outlet),
    })),
    ...angles
      .filter((entry) => !covered.has(entry.source))
      .map((entry) => ({
        outlet: entry.source,
        url: urlByOutlet.get(entry.source) ?? null,
        coverage: undefined,
        angle: entry.angle,
      })),
  ];
}
