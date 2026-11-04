import {
  isoDaysBefore,
  isRecord,
  sampleDeterministic,
  YOUTUBE_VIDEO_ID_PATTERN,
  youTubeWatchUrl,
} from "@ngriffin_uk/polychat-utility-core";

import type { DiscoverResearchResult } from "../research";
import { first, items, lines, joinParts } from "./read";
import type { DiscoverSignal } from "./types";

const YOUTUBE_CHANNEL_LIMIT = 15;

const YOUTUBE_VIDEOS_PER_CHANNEL = 3;

const YOUTUBE_NEW_VIDEO_DAYS = 7;

function youtubeSubscribedChannels(result: unknown): string[] {
  return [
    ...new Set(
      items(result, ["data", "items"], ["items"]).flatMap((subscription) => {
        const channelId = first(subscription, ["snippet", "resourceId", "channelId"]);

        return channelId ? [channelId] : [];
      }),
    ),
  ];
}

function youtubeVideos(results: unknown): Record<string, unknown>[] {
  return (Array.isArray(results) ? results : []).flatMap((result) =>
    items(result, ["data", "items"], ["data", "videos"], ["items"], ["videos"]).filter(isRecord),
  );
}

function youtubeVideoId(video: Record<string, unknown>): string {
  const videoId = first(
    video,
    ["contentDetails", "videoId"],
    ["snippet", "resourceId", "videoId"],
    ["id", "videoId"],
    ["videoId"],
    ["id"],
  );

  return YOUTUBE_VIDEO_ID_PATTERN.test(videoId) ? videoId : "";
}

function youtubeVideoIsPublic(video: Record<string, unknown>): boolean {
  const privacy = first(video, ["status", "privacyStatus"]);

  return !privacy || privacy === "public";
}

function youtubeChannelTitle(video: Record<string, unknown>): string {
  return first(
    video,
    ["snippet", "videoOwnerChannelTitle"],
    ["snippet", "channelTitle"],
    ["channelTitle"],
  );
}

function youtubeNewVideoItems(results: unknown, now: Date): DiscoverResearchResult[] {
  const since = isoDaysBefore(now, YOUTUBE_NEW_VIDEO_DAYS);

  return youtubeVideos(results)
    .flatMap((video) => {
      const videoId = youtubeVideoId(video);
      const title = first(video, ["snippet", "title"], ["title"]);
      const publishedAt = first(
        video,
        ["contentDetails", "videoPublishedAt"],
        ["snippet", "publishedAt"],
        ["publishedAt"],
      );

      return videoId && title && youtubeVideoIsPublic(video) && publishedAt >= since
        ? [{ publishedAt, video, videoId, title }]
        : [];
    })
    .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt))
    .map(({ publishedAt, video, videoId, title }) => ({
      title,
      url: youTubeWatchUrl(videoId),
      snippet: first(video, ["snippet", "description"], ["description"]).slice(0, 400),
      source: youtubeChannelTitle(video) || "YouTube",
      date: publishedAt.slice(0, 10),
      media: "watch" as const,
      image:
        first(video, ["snippet", "thumbnails", "high", "url"], ["thumbnails", "high", "url"]) ||
        undefined,
    }));
}

export const YOUTUBE_SIGNALS: readonly DiscoverSignal[] = [
  {
    id: "youtube-subscriptions",
    providerId: "youtube",
    group: "watching",
    title: "YouTube",
    description: "Reads the channels you subscribe to.",
    operation: "YOUTUBE_LIST_USER_SUBSCRIPTIONS",
    parameters: () => ({ part: "snippet", maxResults: 30 }),
    digest: (result) =>
      lines(items(result, ["data", "items"], ["items"]), (subscription) =>
        joinParts(
          first(subscription, ["snippet", "title"]),
          first(subscription, ["snippet", "description"]).slice(0, 80),
        ),
      ),
  },
  {
    id: "youtube-liked",
    providerId: "youtube",
    group: "watching",
    title: "YouTube likes",
    description: "Reads the videos you liked most recently.",
    operation: "YOUTUBE_LIST_RATED_VIDEOS",
    parameters: () => ({ part: "snippet", rating: "like", max_results: 15 }),
    digest: (result) =>
      lines(items(result, ["data", "items"], ["items"]), (video) =>
        joinParts(
          first(video, ["snippet", "title"]),
          first(video, ["snippet", "channelTitle"]),
          first(video, ["snippet", "publishedAt"]).slice(0, 10),
        ),
      ),
  },
  {
    id: "youtube-new-videos",
    providerId: "youtube",
    group: "watching",
    title: "YouTube new videos",
    description: "Reads this week's new videos from the channels you subscribe to.",
    operation: "YOUTUBE_LIST_USER_SUBSCRIPTIONS",
    parameters: () => ({ part: "snippet", maxResults: 50 }),
    expand: {
      operation: "YOUTUBE_LIST_CHANNEL_VIDEOS",
      requests: (result, { date, now }) =>
        sampleDeterministic(
          youtubeSubscribedChannels(result),
          YOUTUBE_CHANNEL_LIMIT,
          `${date}:${now.getUTCHours()}`,
        ).map((channelId) => ({
          channelId,
          part: "snippet,contentDetails,status",
          maxResults: YOUTUBE_VIDEOS_PER_CHANNEL,
        })),
    },
    items: (results, { now }) => youtubeNewVideoItems(results, now),
    digest: (results) =>
      lines(youtubeVideos(results), (video) =>
        joinParts(first(video, ["snippet", "title"], ["title"]), youtubeChannelTitle(video)),
      ),
  },
];
