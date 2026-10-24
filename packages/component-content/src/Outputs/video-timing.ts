import type { VideoOverviewTiming } from "@ngriffin_uk/polychat-schemas";

const SCENE_SEEK_OFFSET_SECONDS = 0.05;

export function findSceneAt(
  timings: readonly VideoOverviewTiming[],
  seconds: number,
  durationSeconds: number,
): number {
  const lastEnd = timings.at(-1)?.end ?? 0;

  if (lastEnd <= 0) {
    return 0;
  }

  const scale =
    Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds / lastEnd : 1;
  const index = timings.findIndex((timing) => seconds < timing.end * scale);

  return index === -1 ? timings.length - 1 : index;
}

export function sceneStartSeconds(
  timings: readonly VideoOverviewTiming[],
  index: number,
  durationSeconds: number,
): number {
  const lastEnd = timings.at(-1)?.end ?? 0;
  const start = timings[index]?.start ?? 0;

  const scaled =
    lastEnd > 0 && Number.isFinite(durationSeconds) && durationSeconds > 0
      ? (start / lastEnd) * durationSeconds
      : start;

  return index > 0 ? scaled + SCENE_SEEK_OFFSET_SECONDS : scaled;
}
