import type {
  CreateDiscoverWindDown,
  DiscoverWindDown,
  DiscoverWindDownBed,
  DiscoverWindDownTonight,
  DiscoverEpisode,
  DiscoverEpisodeProgress,
  DiscoverEpisodeViewerProgress,
  DiscoverFollow,
  DiscoverEdition,
  DiscoverEditionTime,
  DiscoverFeedbackRequest,
  DiscoverFeedbackResponse,
  DiscoverListenResponse,
  DiscoverRefreshResponse,
  DiscoverResponse,
  DiscoverSettings,
  Source,
  UpdateDiscoverSettings,
} from "@ngriffin_uk/polychat-schemas";

import { apiMediaUrl } from "./media-url.js";
import { requestBlob, requestJson, withQuery } from "./resource.js";

export function getDiscover(): Promise<DiscoverResponse> {
  return requestJson("/discover", "GET");
}

export function getHouseDiscoverEdition(): Promise<DiscoverEdition> {
  return requestJson("/discover/house", "GET");
}

export function getDiscoverEdition(
  date: string,
  edition: DiscoverEditionTime = "morning",
): Promise<DiscoverEdition> {
  return requestJson(
    withQuery(`/discover/editions/${encodeURIComponent(date)}`, { edition }),
    "GET",
  );
}

export function updateDiscoverSettings(input: UpdateDiscoverSettings): Promise<DiscoverSettings> {
  return requestJson("/discover/settings", "PATCH", input);
}

export function refreshDiscover(): Promise<DiscoverRefreshResponse> {
  return requestJson("/discover/refresh", "POST", {});
}

export function sendDiscoverFeedback(
  input: DiscoverFeedbackRequest,
): Promise<DiscoverFeedbackResponse> {
  return requestJson("/discover/feedback", "POST", input);
}

export function getDiscoverCover(coverId: string): Promise<Blob> {
  return requestBlob(`/discover/covers/${encodeURIComponent(coverId)}`);
}

export function followDiscoverTopic(topic: string): Promise<DiscoverFollow> {
  return requestJson("/discover/follows", "POST", { topic });
}

export function unfollowDiscoverTopic(notebookId: string): Promise<{ notebookId: string }> {
  return requestJson(`/discover/follows/${encodeURIComponent(notebookId)}`, "DELETE");
}

export function requestDiscoverListen(editionId: string): Promise<DiscoverListenResponse> {
  return requestJson(`/discover/editions/${encodeURIComponent(editionId)}/listen`, "POST", {});
}

export function requestDiscoverWeek(editionId: string): Promise<{ queued: true }> {
  return requestJson(`/discover/editions/${encodeURIComponent(editionId)}/week`, "POST", {});
}

function cardPath(editionId: string, cardId: string, action: string): string {
  return `/discover/editions/${encodeURIComponent(editionId)}/cards/${encodeURIComponent(cardId)}/${action}`;
}

export function requestDiscoverFraming(editionId: string, cardId: string): Promise<Source> {
  return requestJson(cardPath(editionId, cardId, "framing"), "POST", {});
}

export function requestDiscoverCoverage(editionId: string, cardId: string): Promise<Source> {
  return requestJson(cardPath(editionId, cardId, "coverage"), "POST", {});
}

function episodePath(episodeId: string, suffix = ""): string {
  return `/discover/episodes/${encodeURIComponent(episodeId)}${suffix}`;
}

export function getDiscoverEpisode(episodeId: string): Promise<DiscoverEpisode> {
  return requestJson(episodePath(episodeId), "GET");
}

export function requestDiscoverEpisode(editionId: string): Promise<{ queued: true }> {
  return requestJson(`/discover/editions/${encodeURIComponent(editionId)}/episode`, "POST", {});
}

export function getDiscoverEpisodeAudioUrl(episodeId: string, chapter: number): string {
  return apiMediaUrl(episodePath(episodeId, `/chapters/${chapter}/audio`));
}

export function recordDiscoverEpisodeProgress(
  episodeId: string,
  progress: DiscoverEpisodeProgress,
): Promise<DiscoverEpisodeViewerProgress> {
  return requestJson(episodePath(episodeId, "/progress"), "POST", progress);
}

export function retryDiscoverEpisodeChapter(
  episodeId: string,
  chapter: number,
): Promise<{ queued: true }> {
  return requestJson(episodePath(episodeId, `/chapters/${chapter}/retry`), "POST", {});
}

export function getDiscoverEpisodeShotUrl(
  episodeId: string,
  location: { chapter: number; scene: number; shot: number },
): string {
  return apiMediaUrl(
    episodePath(
      episodeId,
      `/chapters/${location.chapter}/scenes/${location.scene}/shots/${location.shot}`,
    ),
  );
}

export function startDiscoverWindDown(input: CreateDiscoverWindDown): Promise<DiscoverWindDown> {
  return requestJson("/discover/wind-down", "POST", input);
}

export function startDiscoverStory(editionId: string, cardId: string): Promise<DiscoverWindDown> {
  return requestJson(cardPath(editionId, cardId, "story"), "POST", {});
}

export function getDiscoverWindDown(windDownId: string): Promise<DiscoverWindDown> {
  return requestJson(`/discover/wind-down/${encodeURIComponent(windDownId)}`, "GET");
}

export function getDiscoverWindDownTonight(): Promise<DiscoverWindDownTonight> {
  return requestJson("/discover/wind-down/tonight", "GET");
}

export function getDiscoverWindDownBedUrl(bed: DiscoverWindDownBed): string {
  return apiMediaUrl(`/discover/wind-down/beds/${encodeURIComponent(bed)}`);
}

export function getDiscoverWindDownStepUrl(windDownId: string, step: number): string {
  return apiMediaUrl(`/discover/wind-down/${encodeURIComponent(windDownId)}/steps/${step}/audio`);
}

export function queueDiscoverSeasonListen(seasonId: string): Promise<{ queued: true }> {
  return requestJson(`/discover/seasons/${encodeURIComponent(seasonId)}/listen`, "POST", {});
}
