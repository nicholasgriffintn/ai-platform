export interface EpisodeResume {
  chapter: number;
  seconds: number;
}

function resumeKey(episodeId: string) {
  return `polychat:discover-episode:${episodeId}`;
}

export function readEpisodeResume(episodeId: string): EpisodeResume | null {
  try {
    const value = window.localStorage.getItem(resumeKey(episodeId));
    const parsed: unknown = value ? JSON.parse(value) : null;

    if (
      parsed &&
      typeof parsed === "object" &&
      "chapter" in parsed &&
      "seconds" in parsed &&
      typeof parsed.chapter === "number" &&
      typeof parsed.seconds === "number"
    ) {
      return { chapter: parsed.chapter, seconds: parsed.seconds };
    }

    return null;
  } catch {
    return null;
  }
}

export function writeEpisodeResume(episodeId: string, resume: EpisodeResume) {
  try {
    window.localStorage.setItem(resumeKey(episodeId), JSON.stringify(resume));
  } catch {
    return;
  }
}
