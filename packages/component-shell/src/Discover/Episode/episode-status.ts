import type { MediaStatus } from "@ngriffin_uk/polychat-component-ui";
import type {
  DiscoverEdition,
  DiscoverEpisode,
  DiscoverEpisodeChapter,
} from "@ngriffin_uk/polychat-schemas";
import { formatRoundedMinutes } from "@ngriffin_uk/polychat-utility-core";

const BEAT_TIMING_PREFIX = /^\d{1,2}:\d{2}\s*[–-]\s*\d{1,2}:\d{2}\s*[—–-]\s*/u;

export function describeChapterBeats(beats: readonly string[]): string | undefined {
  const spoken = beats
    .map((beat) => beat.replace(BEAT_TIMING_PREFIX, "").trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(" ");

  return spoken || undefined;
}

export function chapterSeconds(chapter: DiscoverEpisodeChapter): number {
  return chapter.timings.at(-1)?.end ?? 0;
}

export function isChapterIllustrating(chapter: DiscoverEpisodeChapter): boolean {
  return (
    chapter.status === "ready" &&
    chapter.scenes.some((scene) => scene.shots.some((shot) => !shot.image))
  );
}

export function chapterStatus(chapter: DiscoverEpisodeChapter): MediaStatus {
  switch (chapter.status) {
    case "pending":
      return { state: "making", label: "Queued" };
    case "scripting":
      return { state: "making", label: "Writing" };
    case "rendering":
      return { state: "making", label: "Recording" };
    case "failed":
      return { state: "failed", label: "Didn't take" };
    case "ready":
      return {
        state: "ready",
        label: isChapterIllustrating(chapter)
          ? `${formatRoundedMinutes(chapterSeconds(chapter))} · drawing`
          : formatRoundedMinutes(chapterSeconds(chapter)),
      };
  }
}

export function episodeStatus(
  edition: Pick<DiscoverEdition, "episodeId" | "episodeFailed" | "episodeOverBudget">,
  episode: DiscoverEpisode | undefined,
  awaiting: boolean,
): MediaStatus {
  if (!edition.episodeId) {
    if (edition.episodeOverBudget) {
      return { state: "failed", label: "Over budget" };
    }

    if (edition.episodeFailed) {
      return { state: "failed", label: "Didn't take" };
    }

    return awaiting
      ? { state: "making", label: "Outlining" }
      : { state: "idle", label: "Not made yet" };
  }

  if (!episode) {
    return { state: "making", label: "Checking" };
  }

  const ready = episode.chapters.filter((chapter) => chapter.status === "ready");
  const inProgress = episode.chapters.find(
    (chapter) => chapter.status !== "ready" && chapter.status !== "failed",
  );

  if (ready.length === episode.chapters.length) {
    return {
      state: "ready",
      label: formatRoundedMinutes(
        ready.reduce((total, chapter) => total + chapterSeconds(chapter), 0),
      ),
    };
  }

  if (ready.length > 0) {
    return { state: "ready", label: `${ready.length} of ${episode.chapters.length} chapters` };
  }

  return inProgress ? chapterStatus(inProgress) : { state: "failed", label: "Didn't take" };
}
