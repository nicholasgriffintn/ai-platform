import {
  useDiscover,
  useDiscoverFeedback,
  useDiscoverFollows,
  useRefreshDiscover,
  useRequestDiscoverListen,
  useRequestDiscoverWeek,
  useRequestDiscoverEpisode,
  useUpdateDiscoverSettings,
} from "@ngriffin_uk/polychat-library-react";
import type {
  DiscoverCard,
  DiscoverFeedbackSignal,
  UpdateDiscoverSettings,
} from "@ngriffin_uk/polychat-schemas";
import { normaliseComparableText } from "@ngriffin_uk/polychat-utility-core";
import { useState } from "react";

import { cardTopic, hasDiscoverTopic } from "./discover-card-drafts.js";
import type { DiscoverMedia } from "./media/media-status.js";

function browserTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

export function useDiscoverEditionController() {
  const [requestedAt, setRequestedAt] = useState<number | null>(null);
  const [episodeRequestedAt, setEpisodeRequestedAt] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<"feed" | "card" | "media">("feed");
  const [chosenMedia, setChosenMedia] = useState<DiscoverMedia | null>(null);
  const [mediaPlaying, setMediaPlaying] = useState(false);
  const discover = useDiscover(true, requestedAt, episodeRequestedAt);
  const requestEpisode = useRequestDiscoverEpisode();
  const requestListen = useRequestDiscoverListen();
  const requestWeek = useRequestDiscoverWeek();
  const updateSettings = useUpdateDiscoverSettings();
  const refresh = useRefreshDiscover();
  const feedback = useDiscoverFeedback();
  const follows = useDiscoverFollows();
  const followed = discover.data?.follows ?? [];
  const followFor = (card: DiscoverCard) =>
    hasDiscoverTopic(card)
      ? followed.find(
          (follow) =>
            normaliseComparableText(follow.topic) === normaliseComparableText(cardTopic(card)),
        )
      : undefined;
  const edition = discover.data?.edition ?? null;
  const settings = discover.data?.settings ?? null;
  const selectedCard =
    view === "card" ? (edition?.cards.find((card) => card.id === selectedId) ?? null) : null;
  const media: DiscoverMedia =
    chosenMedia ?? (settings && settings.episode !== "off" ? "episode" : "perch");
  const hiddenTopics = new Set(
    (edition?.cards ?? []).flatMap((card) =>
      hasDiscoverTopic(card) && edition?.feedback[card.id]?.includes("hide")
        ? [normaliseComparableText(cardTopic(card))]
        : [],
    ),
  );

  const writeEditionNow = async () => {
    const result = await refresh.mutateAsync();

    if (result.status === "queued") {
      setRequestedAt(Date.now());
    }

    return result;
  };

  const sendFeedback = (card: DiscoverCard, signal: DiscoverFeedbackSignal) => {
    if (!edition) {
      return;
    }

    feedback.mutate({ editionId: edition.id, cardId: card.id, signal });
  };

  return {
    discover,
    edition,
    settings,
    selectedCard,
    view,
    media,
    mediaPlaying,
    setMediaPlaying,
    openMedia: (next: DiscoverMedia) => {
      setChosenMedia(next);
      setSelectedId(null);
      setView("media");
    },
    showMedia: () => setView("media"),
    windDownId: discover.data?.windDownId ?? null,
    isRecordingWeek: requestWeek.isPending,
    recordWeekError: requestWeek.error,
    recordWeek: () => {
      if (edition) {
        requestWeek.mutate(edition.id);
      }
    },
    isRecordingListen: requestListen.isPending,
    recordListenError: requestListen.error,
    recordListen: () => {
      if (edition) {
        requestListen.mutate(edition.id);
      }
    },
    isAwaitingEpisode:
      episodeRequestedAt !== null && !edition?.episodeId && !edition?.episodeFailed,
    isRequestingEpisode: requestEpisode.isPending,
    requestEpisodeError: requestEpisode.error,
    requestEpisode: () => {
      if (!edition) {
        return;
      }

      requestEpisode.mutate(edition.id, {
        onSuccess: () => setEpisodeRequestedAt(Date.now()),
      });
    },
    closePanel: () => {
      setSelectedId(null);
      setView("feed");
    },
    isAwaitingEdition: discover.isAwaitingEdition,
    isSavingSettings: updateSettings.isPending,
    isRefreshing: refresh.isPending,
    isSendingFeedback: feedback.isPending,
    follows: followed,
    followFor,
    isChangingFollow: follows.follow.isPending || follows.unfollow.isPending,
    toggleFollow: (card: DiscoverCard) => {
      const current = followFor(card);

      if (current) {
        follows.unfollow.mutate(current.notebookId);
      } else if (hasDiscoverTopic(card)) {
        follows.follow.mutate(cardTopic(card));
      }
    },
    unfollow: (notebookId: string) => follows.unfollow.mutate(notebookId),
    refreshStatus: refresh.data?.status ?? null,
    isTopicHidden: (card: DiscoverCard) =>
      hasDiscoverTopic(card) && hiddenTopics.has(normaliseComparableText(cardTopic(card))),
    select: (card: DiscoverCard | null) => {
      setSelectedId(card?.id ?? null);
      setView(card ? "card" : "feed");

      if (card && edition && !edition.feedback[card.id]?.includes("opened")) {
        feedback.mutate({ editionId: edition.id, cardId: card.id, signal: "opened" });
      }
    },
    sendFeedback,
    writeEditionNow,
    turnOn: async () => {
      await updateSettings.mutateAsync({ enabled: true, timezone: browserTimeZone() });
      await writeEditionNow();
    },
    toggle: (enabled: boolean) =>
      updateSettings.mutate(
        enabled ? { enabled: true, timezone: browserTimeZone() } : { enabled: false },
      ),
    useSource: (providerId: string, used: boolean) =>
      settings &&
      updateSettings.mutate({ enabled: settings.enabled, source: { providerId, used } }),
    saveCurate: (curate: string) =>
      settings && updateSettings.mutate({ enabled: settings.enabled, curate }),
    savePreferences: (
      preferences: Pick<
        UpdateDiscoverSettings,
        "listen" | "evening" | "episode" | "style" | "notify"
      >,
    ) => settings && updateSettings.mutate({ enabled: settings.enabled, ...preferences }),
  };
}

export type DiscoverEditionController = ReturnType<typeof useDiscoverEditionController>;
