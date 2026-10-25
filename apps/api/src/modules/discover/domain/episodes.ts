import {
  DISCOVER_EPISODE_MINUTES,
  DISCOVER_SEASON_PARTS,
  discoverEpisodeViewerProgressSchema,
  type DiscoverEditionContent,
  type DiscoverEpisodeChapter,
  type DiscoverEpisodeContent,
  type DiscoverEpisodeLength,
  type DiscoverEpisodeOutlineDraft,
  type DiscoverEpisodeViewerProgress,
  type DiscoverFollow,
  type DiscoverSeasonContent,
} from "@ngriffin_uk/polychat-schemas";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-core";

import { discoverTopicKey } from "./edition";

const SPOKEN_WORDS_PER_MINUTE = 140;

export function discoverSeasonGroupId(topic: string): string {
  return `discover-season:${discoverTopicKey(topic).replaceAll(" ", "-")}`;
}

export function wordsForMinutes(minutes: number): number {
  return minutes * SPOKEN_WORDS_PER_MINUTE;
}

export function episodeTarget(length: Exclude<DiscoverEpisodeLength, "off">) {
  const minutes = DISCOVER_EPISODE_MINUTES[length];

  return { minutes, words: wordsForMinutes(minutes) };
}

export function pickEpisodeTopic(
  edition: DiscoverEditionContent,
  follows: readonly DiscoverFollow[],
): string | null {
  return follows[0]?.topic ?? edition.interests[0]?.topic ?? null;
}

export function seasonNeedsReplacing(season: DiscoverSeasonContent | null): boolean {
  return !season || season.nextPart > DISCOVER_SEASON_PARTS;
}

export function describeSeasonPlan(season: DiscoverSeasonContent): string {
  const characters = [...season.cast, ...season.places].map(
    (entry) => `- ${entry.plate}: ${entry.description}`,
  );
  const parts = season.parts.map(
    (part, index) =>
      `${index + 1}. ${part.title}: ${part.angle}\n${part.beats.map((beat) => `   - ${beat}`).join("\n")}`,
  );

  return [
    `Title: ${season.title}`,
    "Parts:",
    ...parts,
    "Recurring cast and places (use these plate names):",
    ...characters,
    `Motifs: ${season.motifs.join("; ")}`,
  ].join("\n");
}

export function buildEpisodeChapters(
  outline: DiscoverEpisodeOutlineDraft,
): DiscoverEpisodeChapter[] {
  return outline.chapters.map((chapter) => ({
    title: chapter.title,
    beats: chapter.beats,
    status: "pending" as const,
    timings: [],
    scenes: [],
  }));
}

export function chapterWordTarget(totalWords: number, chapters: number): number {
  return Math.max(150, Math.round(totalWords / Math.max(1, chapters)));
}

export function describeChapterBrief(chapter: DiscoverEpisodeChapter): string {
  return [chapter.title, ...chapter.beats.map((beat) => `- ${beat}`)].join("\n");
}

export function shotImageKey(
  episodeId: string,
  seasonId: string,
  location: { chapter: number; scene: number; shot: number; plate?: string },
): string {
  return location.plate
    ? `outputs/${seasonId}/plates/${location.plate}`
    : `outputs/${episodeId}/shots/${location.chapter}-${location.scene}-${location.shot}`;
}

export function episodeNarration(episode: DiscoverEpisodeContent): string {
  return [
    `# ${episode.title}`,
    ...episode.chapters.map((chapter) =>
      [`## ${chapter.title}`, ...chapter.scenes.map((scene) => scene.narration)].join("\n\n"),
    ),
  ].join("\n\n");
}

export function episodeStudyGroupId(episodeId: string, kind: string): string {
  return `discover-episode-study:${episodeId}:${kind}`;
}

export function readEpisodeProgress(viewerState: string | null): DiscoverEpisodeViewerProgress {
  return discoverEpisodeViewerProgressSchema
    .catch({ furthest: 0, resume: null })
    .parse(safeParseJson(viewerState) ?? {});
}

export function chapterAudioKey(episodeId: string, chapter: number): string {
  return `outputs/${episodeId}/chapters/${chapter}.mp3`;
}
