import { Button, cn, LoadingSpinner } from "@ngriffin_uk/polychat-component-ui";
import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import { isDiscoverListenResearching } from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage, partOfDay } from "@ngriffin_uk/polychat-utility-core";
import { ArrowLeft, AudioLines, MessageCircle, Settings2 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { PageShell } from "../../Shell/PageShell.js";
import { cardTopic, countTopicArticles } from "./discover-card-drafts.js";
import { DiscoverDetailPane } from "./DiscoverDetailPane.js";
import { DiscoverFeed } from "./DiscoverFeed.js";
import { DiscoverMediaShelf } from "./DiscoverMediaShelf.js";
import { DiscoverSettingsDialog } from "./DiscoverSettingsDialog.js";
import {
  DiscoverIdlePane,
  DiscoverNoEdition,
  DiscoverPreparing,
  DiscoverTurnOn,
} from "./DiscoverStates.js";
import { PERCH_GRADIENT, WEEK_GRADIENT } from "./media/discover-art.js";
import { DiscoverEpisodeStage } from "./media/DiscoverEpisodeStage.js";
import { DiscoverListenStage } from "./media/DiscoverListenStage.js";
import { DiscoverWindDownStage } from "./media/DiscoverWindDownStage.js";
import type { DiscoverMedia } from "./media/media-status.js";
import {
  useDiscoverEditionController,
  type DiscoverEditionController,
} from "./useDiscoverEditionController.js";

const REFRESH_MESSAGES = {
  blocked: "Discover can't run right now. Check your Scheduled page.",
  paused: "Discover is paused. Turn it back on in settings.",
  not_enabled: "Turn Discover on first.",
} as const;

const MEDIA_LABELS: Record<DiscoverMedia, string> = {
  episode: "today's episode",
  perch: "The Perch",
  week: "Your week",
  wind_down: "Wind down",
  story: "tonight's story",
};

function useGreeting(): { opener: string; name: string | null } {
  const user = useChatStore((state) => state.user);
  const nickname = useChatStore((state) => state.userSettings?.nickname);
  const name = nickname?.trim() || user?.name?.trim().split(/\s+/)[0] || null;

  const [opener] = useState(() => `Good ${partOfDay(new Date().getHours())}`);

  return { opener, name };
}

function todayLine(): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
}

function DiscoverMediaPane({ controller }: { controller: DiscoverEditionController }) {
  const { ownEdition: edition, media, setMediaPlaying } = controller;
  const [openedAt] = useState(Date.now);

  useEffect(() => () => setMediaPlaying(false), [setMediaPlaying]);

  if (media === "story") {
    return (
      <DiscoverWindDownStage
        key={controller.storyWindDownId}
        windDownId={controller.storyWindDownId}
        story={{ retrying: controller.isStartingStory, onRetry: controller.retryStory }}
        onClose={controller.closePanel}
        onPlayingChange={controller.setMediaPlaying}
      />
    );
  }

  if (media === "wind_down") {
    return (
      <DiscoverWindDownStage
        windDownId={controller.windDownId}
        onClose={controller.closePanel}
        onPlayingChange={controller.setMediaPlaying}
      />
    );
  }

  if (!edition) {
    return <DiscoverIdlePane />;
  }

  if (media === "week") {
    return (
      <DiscoverListenStage
        sourceId={edition.weekSourceId}
        eyebrow="Your week"
        dockHref="/?play=week"
        title="Your week, told back"
        subtitle="What you made, learned and finished. Just for you."
        idleMessage="Your week arrives on Sunday mornings."
        artBackground={WEEK_GRADIENT}
        isRecording={controller.isRecordingWeek}
        recordError={controller.recordWeekError}
        onRecord={controller.recordWeek}
        onClose={controller.closePanel}
        onPlayingChange={controller.setMediaPlaying}
      />
    );
  }

  return media === "episode" ? (
    <DiscoverEpisodeStage
      edition={edition}
      awaiting={controller.isAwaitingEpisode}
      isRequesting={controller.isRequestingEpisode}
      requestError={controller.requestEpisodeError}
      onRequest={controller.requestEpisode}
      onClose={controller.closePanel}
      onPlayingChange={controller.setMediaPlaying}
    />
  ) : (
    <DiscoverListenStage
      sourceId={edition.listenSourceId}
      researching={isDiscoverListenResearching(edition, openedAt)}
      eyebrow="The Perch"
      dockHref="/?play=perch"
      title="Today's round-up"
      subtitle="Two hosts dig into today's topics, from the research behind the edition."
      idleMessage="Two hosts research today's topics, then talk them through in depth."
      artBackground={PERCH_GRADIENT}
      isRecording={controller.isRecordingListen}
      recordError={controller.recordListenError}
      onRecord={controller.recordListen}
      onClose={controller.closePanel}
      onPlayingChange={controller.setMediaPlaying}
    />
  );
}

function DiscoverAskBar({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="shrink-0 border-t border-border bg-background px-4 py-3 lg:hidden">
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-3 rounded-full border border-border bg-surface px-4 py-3 text-left text-sm text-muted-foreground shadow-sm hover:text-foreground"
      >
        <MessageCircle size={16} className="text-active-work" aria-hidden />
        Ask Poly anything
      </button>
    </div>
  );
}

function DiscoverAskPane({ ask, onBack }: { ask: ReactNode; onBack: () => void }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2 lg:hidden">
        <Button variant="icon" size="icon" aria-label="Back to the edition" onClick={onBack}>
          <ArrowLeft size={16} aria-hidden />
        </Button>
        <span className="text-sm font-medium text-foreground">Ask</span>
      </div>
      <div className="min-h-0 flex-1">{ask}</div>
    </div>
  );
}

function DiscoverLeftPane({
  controller,
  todayText,
  greeting,
}: {
  controller: DiscoverEditionController;
  todayText: string;
  greeting: { opener: string; name: string | null };
}) {
  const { edition, ownEdition, settings, selectedCard, view, isAuthenticated } = controller;
  const refreshMessage =
    controller.refreshStatus && controller.refreshStatus !== "queued"
      ? REFRESH_MESSAGES[controller.refreshStatus]
      : null;
  const showTurnOn = isAuthenticated && settings !== null && !settings.enabled && !ownEdition;
  const showNoEdition =
    isAuthenticated && settings?.enabled === true && !ownEdition && !controller.isAwaitingEdition;
  const feed = edition ? (
    <DiscoverFeed
      edition={edition}
      selectedId={selectedCard?.id ?? null}
      isTopicHidden={controller.isTopicHidden}
      isFollowing={(card) => Boolean(controller.followFor(card))}
      onSelect={controller.select}
      startingStoryId={controller.startingStoryId}
      failedStoryId={controller.failedStoryId}
      openStoryId={controller.openStoryId}
      onStartStory={controller.startStory}
      media={
        ownEdition && settings ? (
          <DiscoverMediaShelf
            edition={ownEdition}
            showEpisode={settings.episode !== "off" || Boolean(ownEdition.episodeId)}
            awaitingEpisode={controller.isAwaitingEpisode}
            windDownId={controller.windDownId}
            active={view === "media" ? controller.media : null}
            onOpen={controller.openMedia}
          />
        ) : null
      }
    />
  ) : controller.house.isLoading ? (
    <div className="flex justify-center py-10">
      <LoadingSpinner />
    </div>
  ) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="polychat-eyebrow">{todayText}</p>
        <h1 className="font-display text-[2.1rem] leading-tight font-medium tracking-tight text-foreground">
          {greeting.opener}
          {greeting.name && (
            <>
              , <em>{greeting.name}</em>
            </>
          )}
        </h1>
      </div>
      {refreshMessage && <p className="text-sm text-muted-foreground">{refreshMessage}</p>}
      {showTurnOn && (
        <DiscoverTurnOn
          isWorking={controller.isSavingSettings || controller.isRefreshing}
          onTurnOn={() => void controller.turnOn()}
        />
      )}
      {showNoEdition && (
        <DiscoverNoEdition
          isRefreshing={controller.isRefreshing}
          onWriteNow={() => void controller.writeEditionNow()}
        />
      )}
      {controller.isAwaitingEdition ? <DiscoverPreparing /> : feed}
    </div>
  );
}

export function DiscoverEditionView({ ask }: { ask?: ReactNode }) {
  const controller = useDiscoverEditionController();
  const [showSettings, setShowSettings] = useState(false);
  const greeting = useGreeting();
  const [today] = useState(todayLine);

  const { discover, ownEdition, settings, selectedCard, view, isAuthenticated } = controller;
  const detailOpen = view !== "feed";
  const isLoading =
    controller.isAuthenticationLoading || (isAuthenticated && (discover.isLoading || !settings));

  if (isLoading) {
    return (
      <>
        <PageShell.Header title="Discover" />
        <div className="flex h-full items-center justify-center">
          {discover.error ? (
            <p className="text-sm text-failure">
              {getErrorMessage(discover.error, "Discover could not be loaded")}
            </p>
          ) : (
            <LoadingSpinner />
          )}
        </div>
      </>
    );
  }

  const showMedia = view === "media" && isAuthenticated;
  const cardOpen = Boolean(selectedCard && ownEdition);
  const mediaMounted = showMedia || (controller.mediaPlaying && cardOpen);
  const rightPane =
    selectedCard && ownEdition ? (
      <div className="flex h-full min-h-0 flex-col">
        {controller.mediaPlaying && (
          <button
            type="button"
            onClick={controller.showMedia}
            className="flex shrink-0 items-center gap-2 border-b border-border bg-surface px-5 py-2 text-left text-xs text-muted-foreground hover:text-foreground sm:px-8"
          >
            <AudioLines size={14} className="text-active-work" aria-hidden />
            Still playing {MEDIA_LABELS[controller.media]}
            <span className="ml-auto font-medium text-foreground">Back to it</span>
          </button>
        )}
        <div className="min-h-0 flex-1">
          <DiscoverDetailPane
            editionId={ownEdition.id}
            card={selectedCard}
            topicArticleCount={countTopicArticles(ownEdition.cards, cardTopic(selectedCard))}
            signals={ownEdition.feedback[selectedCard.id] ?? []}
            isSending={controller.isSendingFeedback}
            follow={controller.followFor(selectedCard)}
            isChangingFollow={controller.isChangingFollow}
            onToggleFollow={controller.toggleFollow}
            onFeedback={controller.sendFeedback}
            onClose={controller.closePanel}
          />
        </div>
      </div>
    ) : showMedia ? null : ask ? (
      <DiscoverAskPane ask={ask} onBack={controller.closePanel} />
    ) : (
      <DiscoverIdlePane />
    );

  return (
    <>
      <PageShell.Header title="Discover" />
      {isAuthenticated && settings && (
        <DiscoverSettingsDialog
          open={showSettings}
          onOpenChange={setShowSettings}
          settings={settings}
          isSaving={controller.isSavingSettings}
          canWriteAgain={Boolean(ownEdition)}
          isWriting={controller.isRefreshing || controller.isAwaitingEdition}
          onWriteAgain={() => void controller.writeEditionNow()}
          follows={controller.follows}
          onUnfollow={controller.unfollow}
          onToggle={controller.toggle}
          onUseSource={controller.useSource}
          onSaveCurate={controller.saveCurate}
          onSavePreferences={controller.savePreferences}
        />
      )}
      <div className="flex h-full min-h-0">
        <div
          className={cn(
            "flex w-full shrink-0 flex-col border-border lg:w-[26rem] lg:border-r",
            detailOpen && "hidden lg:flex",
          )}
        >
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-6 pb-10 lg:px-6">
            <DiscoverLeftPane controller={controller} todayText={today} greeting={greeting} />
            {isAuthenticated && settings ? (
              <div className="mt-2">
                <Button variant="outline" size="sm" onClick={() => setShowSettings(true)}>
                  <Settings2 size={14} aria-hidden />
                  Settings
                </Button>
              </div>
            ) : undefined}
          </div>
          <DiscoverAskBar onOpen={controller.openAsk} />
        </div>
        <div className={cn("relative min-w-0 flex-1", !detailOpen && "hidden lg:block")}>
          {mediaMounted && (
            <div className={cn("h-full", !showMedia && "hidden")}>
              <DiscoverMediaPane controller={controller} />
            </div>
          )}
          {rightPane}
        </div>
      </div>
    </>
  );
}
