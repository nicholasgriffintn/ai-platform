import {
  followDiscoverTopic,
  getDiscover,
  getDiscoverCover,
  getDiscoverEpisode,
  getDiscoverWindDown,
  queueDiscoverSeasonListen,
  startDiscoverWindDown,
  unfollowDiscoverTopic,
  refreshDiscover,
  requestDiscoverEpisode,
  recordDiscoverEpisodeProgress,
  requestDiscoverListen,
  requestDiscoverWeek,
  retryDiscoverEpisodeChapter,
  sendDiscoverFeedback,
  updateDiscoverSettings,
} from "@ngriffin_uk/polychat-library-client";
import type {
  CreateDiscoverWindDown,
  DiscoverEpisode,
  DiscoverFeedbackRequest,
  DiscoverResponse,
  DiscoverWindDown,
  UpdateDiscoverSettings,
} from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useLiveOrPoll } from "../sync/live-or-poll.js";
import { NOTEBOOKS_QUERY_KEY } from "./useNotebooks.js";

export const DISCOVER_QUERY_KEY = ["discover"] as const;

const AWAITING_EDITION_POLL_MS = 8_000;

function isAwaitingEdition(data: DiscoverResponse | undefined, requestedAt: number | null) {
  if (requestedAt === null) {
    return false;
  }

  const generatedAt = data?.edition ? Date.parse(data.edition.generatedAt) : Number.NaN;

  return !Number.isFinite(generatedAt) || generatedAt < requestedAt;
}

function isAwaitingMedia(data: DiscoverResponse | undefined, mediaRequestedAt: number | null) {
  const edition = data?.edition;

  if (!edition) {
    return false;
  }

  return (
    edition.cards.some((card) => card.kind === "topic" && !card.coverId) ||
    (mediaRequestedAt !== null && !edition.episodeId && !edition.episodeFailed)
  );
}

export function useDiscover(
  enabled: boolean,
  requestedAt: number | null = null,
  mediaRequestedAt: number | null = null,
) {
  const liveOrPoll = useLiveOrPoll();
  const query = useQuery({
    queryKey: DISCOVER_QUERY_KEY,
    queryFn: getDiscover,
    enabled,
    refetchInterval: (current) =>
      liveOrPoll(
        current,
        isAwaitingEdition(current.state.data, requestedAt) ||
          isAwaitingMedia(current.state.data, mediaRequestedAt)
          ? AWAITING_EDITION_POLL_MS
          : false,
        "discover.changed",
      ),
  });

  return { ...query, isAwaitingEdition: isAwaitingEdition(query.data, requestedAt) };
}

export function useUpdateDiscoverSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateDiscoverSettings) => updateDiscoverSettings(input),
    onSuccess: (settings) => {
      queryClient.setQueryData<DiscoverResponse>(DISCOVER_QUERY_KEY, (current) =>
        current ? { ...current, settings } : current,
      );
    },
  });
}

export function useRefreshDiscover() {
  return useMutation({ mutationFn: () => refreshDiscover() });
}

export function useDiscoverFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: DiscoverFeedbackRequest) => sendDiscoverFeedback(input),
    onSuccess: (result, input) => {
      queryClient.setQueryData<DiscoverResponse>(DISCOVER_QUERY_KEY, (current) =>
        current?.edition?.id === input.editionId
          ? {
              ...current,
              edition: {
                ...current.edition,
                feedback: { ...current.edition.feedback, [result.cardId]: result.signals },
              },
            }
          : current,
      );
    },
  });
}

export function useDiscoverCover(coverId: string | undefined) {
  return useQuery({
    queryKey: [...DISCOVER_QUERY_KEY, "cover", coverId],
    queryFn: () => getDiscoverCover(coverId ?? ""),
    enabled: Boolean(coverId),
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });
}

export function useDiscoverFollows() {
  const queryClient = useQueryClient();
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: DISCOVER_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: [NOTEBOOKS_QUERY_KEY] }),
    ]);
  const follow = useMutation({
    mutationFn: (topic: string) => followDiscoverTopic(topic),
    onSuccess: refresh,
  });
  const unfollow = useMutation({
    mutationFn: (notebookId: string) => unfollowDiscoverTopic(notebookId),
    onSuccess: refresh,
  });

  return { follow, unfollow };
}

export function useRequestDiscoverWeek() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (editionId: string) => requestDiscoverWeek(editionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DISCOVER_QUERY_KEY }),
  });
}

export function useRequestDiscoverListen() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (editionId: string) => requestDiscoverListen(editionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DISCOVER_QUERY_KEY }),
  });
}

const EPISODE_POLL_MS = 6_000;
const WIND_DOWN_POLL_MS = 3_000;

function isEpisodeInProgress(episode: DiscoverEpisode | undefined): boolean {
  return Boolean(
    episode?.chapters.some(
      (chapter) =>
        (chapter.status !== "ready" && chapter.status !== "failed") ||
        (chapter.status === "ready" &&
          chapter.scenes.some((scene) => scene.shots.some((shot) => !shot.image))),
    ),
  );
}

function isWindDownInProgress(windDown: DiscoverWindDown | undefined): boolean {
  return windDown?.status === "pending" || windDown?.status === "speaking";
}

export function useDiscoverEpisode(episodeId: string | undefined) {
  const liveOrPoll = useLiveOrPoll();

  return useQuery({
    queryKey: [...DISCOVER_QUERY_KEY, "episode", episodeId],
    queryFn: () => getDiscoverEpisode(episodeId ?? ""),
    enabled: Boolean(episodeId),
    refetchInterval: (query) =>
      liveOrPoll(
        query,
        isEpisodeInProgress(query.state.data) ? EPISODE_POLL_MS : false,
        "discover.changed",
      ),
  });
}

export function useRecordDiscoverEpisodeProgress(episodeId: string) {
  return useMutation({
    mutationFn: (fraction: number) => recordDiscoverEpisodeProgress(episodeId, fraction),
  });
}

export function useRetryDiscoverEpisodeChapter(episodeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (chapter: number) => retryDiscoverEpisodeChapter(episodeId, chapter),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: [...DISCOVER_QUERY_KEY, "episode", episodeId] }),
  });
}

export function useRequestDiscoverEpisode() {
  return useMutation({ mutationFn: (editionId: string) => requestDiscoverEpisode(editionId) });
}

export function useDiscoverWindDown(windDownId: string | null | undefined) {
  const liveOrPoll = useLiveOrPoll();

  return useQuery({
    queryKey: [...DISCOVER_QUERY_KEY, "wind-down", windDownId],
    queryFn: () => getDiscoverWindDown(windDownId ?? ""),
    enabled: Boolean(windDownId),
    refetchInterval: (query) =>
      liveOrPoll(
        query,
        isWindDownInProgress(query.state.data) ? WIND_DOWN_POLL_MS : false,
        "discover.changed",
      ),
  });
}

export function useStartDiscoverWindDown() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateDiscoverWindDown) => startDiscoverWindDown(input),
    onSuccess: (windDown) => {
      queryClient.setQueryData<DiscoverResponse>(DISCOVER_QUERY_KEY, (current) =>
        current ? { ...current, windDownId: windDown.id } : current,
      );
    },
  });
}

export function useQueueDiscoverSeasonListen() {
  return useMutation({ mutationFn: (seasonId: string) => queueDiscoverSeasonListen(seasonId) });
}
