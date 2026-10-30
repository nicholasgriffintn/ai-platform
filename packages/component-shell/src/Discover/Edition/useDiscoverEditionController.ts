import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import {
  useDiscover,
  useDiscoverFeedback,
  useDiscoverFollows,
  useHouseDiscoverEdition,
  useRefreshDiscover,
  useRequestDiscoverListen,
  useRequestDiscoverWeek,
  useRequestDiscoverEpisode,
  useStartDiscoverStory,
  useUpdateDiscoverSettings,
} from "@ngriffin_uk/polychat-library-react";
import type {
  DiscoverCard,
  DiscoverFeedbackSignal,
  UpdateDiscoverSettings,
} from "@ngriffin_uk/polychat-schemas";
import { normaliseComparableText, readLocalTimeZone } from "@ngriffin_uk/polychat-utility-core";
import { useState } from "react";
import { useSearchParams } from "react-router";

import { cardTopic, hasDiscoverTopic } from "./discover-card-drafts.js";
import type { DiscoverStoryCard } from "./DiscoverStoryTile.js";
import type { DiscoverMedia } from "./media/media-status.js";

export type DiscoverEditionViewState = "feed" | "card" | "media" | "ask";

const PLAY_PARAM = "play";
const LINKABLE_MEDIA = [
  "episode",
  "perch",
  "week",
  "wind_down",
] as const satisfies readonly DiscoverMedia[];

function readPlayParam(value: string | null): DiscoverMedia | null {
  return LINKABLE_MEDIA.find((media) => media === value) ?? null;
}

function cardPrompt(card: DiscoverCard): string | null {
  switch (card.kind) {
    case "topic":
    case "action":
      return card.prompt;
    case "check_in":
      return card.question;
    default:
      return null;
  }
}

export function useDiscoverEditionController() {
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const isAuthenticationLoading = useChatStore((state) => state.isAuthenticationLoading);
  const setChatInput = useChatStore((state) => state.setChatInput);
  const [searchParams, setSearchParams] = useSearchParams();
  const linkedMedia = readPlayParam(searchParams.get(PLAY_PARAM));
  const [requestedAt, setRequestedAt] = useState<number | null>(null);
  const [episodeRequestedAt, setEpisodeRequestedAt] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<DiscoverEditionViewState>(linkedMedia ? "media" : "feed");
  const [chosenMedia, setChosenMedia] = useState<DiscoverMedia | null>(linkedMedia);
  const [mediaPlaying, setMediaPlaying] = useState(false);
  const discover = useDiscover(isAuthenticated, requestedAt, episodeRequestedAt);
  const ownEdition = discover.data?.edition ?? null;
  const settings = discover.data?.settings ?? null;
  const isAwaitingEdition = discover.isAwaitingEdition;
  const needsHouseEdition =
    !isAuthenticationLoading &&
    (!isAuthenticated || (discover.isFetched && !ownEdition && !isAwaitingEdition));
  const house = useHouseDiscoverEdition(needsHouseEdition);
  const edition = ownEdition ?? (needsHouseEdition ? (house.data ?? null) : null);
  const isHouseEdition = !ownEdition && edition !== null;
  const requestEpisode = useRequestDiscoverEpisode();
  const requestListen = useRequestDiscoverListen();
  const requestWeek = useRequestDiscoverWeek();
  const startStory = useStartDiscoverStory();
  const [storyCardId, setStoryCardId] = useState<string | null>(null);
  const [storyWindDownId, setStoryWindDownId] = useState<string | null>(null);
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

  const setPlayParam = (next: DiscoverMedia | null) => {
    const params = new URLSearchParams(searchParams);

    if (next && LINKABLE_MEDIA.some((linkable) => linkable === next)) {
      params.set(PLAY_PARAM, next);
    } else {
      params.delete(PLAY_PARAM);
    }

    if (params.toString() !== searchParams.toString()) {
      setSearchParams(params, { replace: true });
    }
  };

  const writeEditionNow = async () => {
    const result = await refresh.mutateAsync();

    if (result.status === "queued") {
      setRequestedAt(Date.now());
    }

    return result;
  };

  const openMedia = (next: DiscoverMedia) => {
    setChosenMedia(next);
    setSelectedId(null);
    setView("media");
    setPlayParam(next);
  };

  const closePanel = () => {
    setSelectedId(null);
    setView("feed");
    setPlayParam(null);
  };

  const sendFeedback = (card: DiscoverCard, signal: DiscoverFeedbackSignal) => {
    if (!ownEdition) {
      return;
    }

    feedback.mutate({ editionId: ownEdition.id, cardId: card.id, signal });
  };

  const playStory = (cardId: string) => {
    if (!ownEdition) {
      return;
    }

    setStoryCardId(cardId);
    startStory.mutate(
      { editionId: ownEdition.id, cardId },
      {
        onSuccess: (windDown) => {
          setStoryWindDownId(windDown.id);
          openMedia("story");
        },
      },
    );
  };

  return {
    isAuthenticated,
    isAuthenticationLoading,
    discover,
    house,
    edition,
    ownEdition,
    isHouseEdition,
    settings,
    selectedCard,
    view,
    media,
    mediaPlaying,
    setMediaPlaying,
    openMedia,
    openAsk: () => {
      setSelectedId(null);
      setView("ask");
      setPlayParam(null);
    },
    startingStoryId: startStory.isPending ? storyCardId : null,
    failedStoryId: startStory.isError ? storyCardId : null,
    openStoryId: view === "media" && media === "story" ? storyCardId : null,
    storyWindDownId,
    isStartingStory: startStory.isPending,
    startStory: (card: DiscoverStoryCard) => {
      if (!edition?.feedback[card.id]?.includes("opened")) {
        sendFeedback(card, "opened");
      }

      playStory(card.id);
    },
    retryStory: () => {
      if (storyCardId) {
        playStory(storyCardId);
      }
    },
    showMedia: () => {
      setView("media");
      setPlayParam(media);
    },
    windDownId: discover.data?.windDownId ?? null,
    isRecordingWeek: requestWeek.isPending,
    recordWeekError: requestWeek.error,
    recordWeek: () => {
      if (ownEdition) {
        requestWeek.mutate(ownEdition.id);
      }
    },
    isRecordingListen: requestListen.isPending,
    recordListenError: requestListen.error,
    recordListen: () => {
      if (ownEdition) {
        requestListen.mutate(ownEdition.id);
      }
    },
    isAwaitingEpisode:
      episodeRequestedAt !== null && !ownEdition?.episodeId && !ownEdition?.episodeFailed,
    isRequestingEpisode: requestEpisode.isPending,
    requestEpisodeError: requestEpisode.error,
    requestEpisode: () => {
      if (!ownEdition) {
        return;
      }

      requestEpisode.mutate(ownEdition.id, {
        onSuccess: () => setEpisodeRequestedAt(Date.now()),
      });
    },
    closePanel,
    isAwaitingEdition,
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
      if (card && isHouseEdition) {
        const prompt = cardPrompt(card);

        if (prompt) {
          setChatInput(prompt);
        }

        setSelectedId(null);
        setView("ask");
        setPlayParam(null);

        return;
      }

      setSelectedId(card?.id ?? null);
      setView(card ? "card" : "feed");
      setPlayParam(null);

      if (card && ownEdition && !ownEdition.feedback[card.id]?.includes("opened")) {
        feedback.mutate({ editionId: ownEdition.id, cardId: card.id, signal: "opened" });
      }
    },
    sendFeedback,
    writeEditionNow,
    turnOn: async () => {
      await updateSettings.mutateAsync({ enabled: true, timezone: readLocalTimeZone() });
      await writeEditionNow();
    },
    toggle: (enabled: boolean) =>
      updateSettings.mutate(
        enabled ? { enabled: true, timezone: readLocalTimeZone() } : { enabled: false },
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
