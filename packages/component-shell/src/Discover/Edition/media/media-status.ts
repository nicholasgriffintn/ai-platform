import type { MediaStatus } from "@ngriffin_uk/polychat-component-ui";
import { readSourceMedia, type DiscoverWindDown, type Source } from "@ngriffin_uk/polychat-schemas";
import { formatRoundedMinutes } from "@ngriffin_uk/polychat-utility-core";

export type DiscoverMedia = "episode" | "perch" | "week" | "wind_down";

export function listenStatus(
  sourceId: string | undefined,
  source: Source | undefined,
): MediaStatus {
  if (!sourceId) {
    return { state: "idle", label: "Not recorded yet" };
  }

  if (!source) {
    return { state: "making", label: "Checking" };
  }

  if (source.status === "available" && source.file) {
    const seconds = readSourceMedia(source.metadata).durationSeconds;

    return { state: "ready", label: seconds ? formatRoundedMinutes(seconds) : "Ready" };
  }

  return source.status === "processing"
    ? { state: "making", label: "Recording" }
    : { state: "failed", label: "Didn't record" };
}

export function windDownStatus(windDown: DiscoverWindDown | undefined): MediaStatus {
  if (!windDown) {
    return { state: "idle", label: "5 to 30 min" };
  }

  if (windDown.status === "failed") {
    return { state: "failed", label: "Didn't take" };
  }

  return windDown.kind === "sound" || windDown.steps[0]?.audio
    ? { state: "ready", label: `${windDown.minutes} min` }
    : { state: "making", label: "Settling in" };
}
