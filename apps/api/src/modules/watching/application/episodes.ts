import { fetchTmdbTitle } from "@ngriffin_uk/polychat-ai-integrations";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  isEpisodeAtOrAfter,
  listEpisodesThrough,
  rollUpShelfStatus,
  type EpisodeRef,
} from "~/modules/watching/domain/episodes";
import { findShelfEntry, saveShelfEntry, saveShelfEpisodes } from "~/modules/watching/domain/shelf";

import { requireTitleRef, requireTmdbToken } from "./catalogue";
import { readShelfContent, updateShelfContent } from "./shelf-store";
import { syncEpisodesToTrakt } from "./trakt";

const FINISHED_SERIES_STATUSES = new Set(["Ended", "Canceled"]);

export interface MarkEpisodesInput extends EpisodeRef {
  titleId: string;
  watched: boolean;
  upToHere: boolean;
  rating?: number;
  notes?: string;
}

export async function markEpisodes(context: ServiceContext, input: MarkEpisodesInput) {
  const details = await fetchTmdbTitle(requireTmdbToken(context), requireTitleRef(input.titleId));
  const targets = input.upToHere ? listEpisodesThrough(details.seasonSizes, input) : [input];
  const finished =
    input.watched &&
    details.lastAired !== null &&
    isEpisodeAtOrAfter(input, details.lastAired) &&
    FINISHED_SERIES_STATUSES.has(details.status ?? "");

  const shelf = await updateShelfContent(context, (content) => {
    const current = findShelfEntry(content, details.id);
    const saved = saveShelfEntry(content, {
      titleId: details.id,
      mediaType: details.mediaType,
      title: details.title,
      year: details.year,
      status: input.watched
        ? rollUpShelfStatus(current?.status, finished)
        : (current?.status ?? "watching"),
    });

    return {
      ...saved,
      entries: saved.entries.map((entry) =>
        entry.titleId === details.id
          ? {
              ...entry,
              episodes: saveShelfEpisodes(entry, targets, input.watched, {
                target: input,
                rating: input.rating,
                notes: input.notes,
              }),
            }
          : entry,
      ),
    };
  });

  const entry = findShelfEntry(shelf, details.id);

  return {
    id: details.id,
    title: details.title,
    marked: targets.length,
    status: entry?.status ?? null,
    trakt: entry ? await syncEpisodesToTrakt(context, entry, targets, input.watched) : "failed",
  };
}

export async function readEpisodeProgress(context: ServiceContext, titleId: string) {
  const ref = requireTitleRef(titleId);
  const shelf = await readShelfContent(context);
  const entry = findShelfEntry(shelf, `${ref.mediaType}:${ref.tmdbId}`);
  const episodes = entry?.episodes ?? [];
  const watched = episodes.filter((episode) => episode.watched);
  const furthest = watched.at(-1);

  return {
    watchedCount: watched.length,
    furthest: furthest ? { season: furthest.season, episode: furthest.episode } : null,
    episodes,
    imported: entry?.importedProgress ?? null,
  };
}
