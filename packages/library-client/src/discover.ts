import type {
  CreateDiscoverWindDown,
  DiscoverWindDown,
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
  UpdateDiscoverSettings,
} from "@ngriffin_uk/polychat-schemas";

import { apiMediaUrl } from "./media-url.js";
import { requestBlob, requestJson, withQuery } from "./resource.js";

export function getDiscover(): Promise<DiscoverResponse> {
  return requestJson("/discover", "GET");
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

export function getDiscoverWindDown(windDownId: string): Promise<DiscoverWindDown> {
  return requestJson(`/discover/wind-down/${encodeURIComponent(windDownId)}`, "GET");
}

export function getDiscoverWindDownAmbientUrl(windDownId: string): string {
  return apiMediaUrl(`/discover/wind-down/${encodeURIComponent(windDownId)}/ambient`);
}

export function getDiscoverWindDownStepUrl(windDownId: string, step: number): string {
  return apiMediaUrl(`/discover/wind-down/${encodeURIComponent(windDownId)}/steps/${step}/audio`);
}

export function queueDiscoverSeasonListen(seasonId: string): Promise<{ queued: true }> {
  return requestJson(`/discover/seasons/${encodeURIComponent(seasonId)}/listen`, "POST", {});
}
