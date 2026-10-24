import { getDiscoverEpisodeShotUrl } from "@ngriffin_uk/polychat-library-client";
import type { DiscoverEpisode } from "@ngriffin_uk/polychat-schemas";

export function episodeCoverUrl(episode: DiscoverEpisode): string | null {
  for (const [chapter, entry] of episode.chapters.entries()) {
    for (const [scene, sceneEntry] of entry.scenes.entries()) {
      const shot = sceneEntry.shots.findIndex((candidate) => candidate.image);

      if (shot >= 0) {
        return getDiscoverEpisodeShotUrl(episode.id, { chapter, scene, shot });
      }
    }
  }

  return null;
}
