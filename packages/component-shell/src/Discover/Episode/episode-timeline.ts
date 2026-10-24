import type { DiscoverEpisodeChapter } from "@ngriffin_uk/polychat-schemas";

export interface EpisodeShotPosition {
  scene: number;
  shot: number;
  shotSeconds: number;
}

export function locateEpisodeShot(
  chapter: DiscoverEpisodeChapter,
  seconds: number,
): EpisodeShotPosition {
  const current = chapter.timings.findIndex((timing) => seconds < timing.end);
  const sceneIndex = current === -1 ? Math.max(0, chapter.timings.length - 1) : current;
  const scene = chapter.scenes[sceneIndex] ?? chapter.scenes[0];
  const timing = chapter.timings[sceneIndex];

  if (!scene || !timing) {
    return { scene: 0, shot: 0, shotSeconds: 10 };
  }

  const shotSeconds = Math.max(1, (timing.end - timing.start) / scene.shots.length);
  const shot = Math.min(
    scene.shots.length - 1,
    Math.max(0, Math.floor((seconds - timing.start) / shotSeconds)),
  );

  return { scene: sceneIndex, shot, shotSeconds };
}

export function nextEpisodeShot(
  chapter: DiscoverEpisodeChapter,
  position: EpisodeShotPosition,
): { scene: number; shot: number } | null {
  if (position.shot + 1 < (chapter.scenes[position.scene]?.shots.length ?? 0)) {
    return { scene: position.scene, shot: position.shot + 1 };
  }

  return chapter.scenes[position.scene + 1] ? { scene: position.scene + 1, shot: 0 } : null;
}
