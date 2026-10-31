import { Button, cn, LoadingSpinner } from "@ngriffin_uk/polychat-component-ui";
import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import { isDiscoverListenResearching } from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage, partOfDay } from "@ngriffin_uk/polychat-utility-core";
import { useElementSize } from "@ngriffin_uk/polychat-utility-react";
import { AudioLines, Settings2 } from "lucide-react";
import { useEffect, useState, type ReactNode, type UIEvent } from "react";

import { PageShell } from "../../Shell/PageShell.js";
import { cardTopic, countTopicArticles } from "./discover-card-drafts.js";
import { DiscoverBrief } from "./DiscoverBrief.js";
import { DiscoverDetailPane } from "./DiscoverDetailPane.js";
import { DiscoverFeed } from "./DiscoverFeed.js";
import { DiscoverMasthead, type DiscoverGreeting } from "./DiscoverMasthead.js";
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

const PANEL_CLASS =
  "absolute inset-0 z-20 flex min-h-0 flex-col bg-background lg:static lg:inset-auto lg:z-auto lg:w-[26rem] lg:shrink-0 lg:border-l lg:border-border xl:w-[32rem] 2xl:w-[min(46rem,45%)]";

const FLOATING_COMPOSER_CLASS =
  "pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col px-2 pt-24 pb-2 [background:linear-gradient(to_top,var(--background)_calc(100%-6rem),transparent)] sm:px-6 sm:pb-4";

const COMPOSER_CLEARANCE = 40;

const SCROLLED_THRESHOLD = 24;

export interface DiscoverChatSlot {
  isOpen: boolean;
  header: ReactNode;
  thread: ReactNode;
}

function useGreeting(): DiscoverGreeting {
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

function DiscoverEditionBody({ controller }: { controller: DiscoverEditionController }) {
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
    <>
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
    </>
  );
}

function DiscoverSidePanel({ controller }: { controller: DiscoverEditionController }) {
  const { ownEdition, selectedCard, view, isAuthenticated } = controller;
  const showMedia = view === "media" && isAuthenticated;
  const cardOpen = Boolean(selectedCard && ownEdition);
  const mediaMounted = showMedia || (controller.mediaPlaying && cardOpen);

  return (
    <aside className={PANEL_CLASS} aria-label="Discover detail">
      {mediaMounted && (
        <div className={cn("h-full", !showMedia && "hidden")}>
          <DiscoverMediaPane controller={controller} />
        </div>
      )}
      {selectedCard && ownEdition ? (
        <div className="flex h-full min-h-0 flex-col">
          {controller.mediaPlaying && (
            <button
              type="button"
              onClick={controller.showMedia}
              className="flex shrink-0 items-center gap-2 border-b border-border bg-surface px-5 py-2 text-left text-xs text-muted-foreground hover:text-foreground"
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
      ) : null}
    </aside>
  );
}

export function DiscoverEditionView({ chat }: { chat?: DiscoverChatSlot }) {
  const controller = useDiscoverEditionController();
  const [showSettings, setShowSettings] = useState(false);
  const greeting = useGreeting();
  const [today] = useState(todayLine);
  const { ref: composerRef, height: composerHeight } = useElementSize<HTMLDivElement>();
  const [scrolled, setScrolled] = useState(false);

  const { discover, edition, ownEdition, settings, selectedCard, view, isAuthenticated } =
    controller;
  const isLoading =
    controller.isAuthenticationLoading || (isAuthenticated && (discover.isLoading || !settings));

  if (isLoading) {
    return (
      <>
        <PageShell.Header title="Discover" bordered />
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

  const detailOpen =
    view === "card" ? Boolean(selectedCard && ownEdition) : view === "media" && isAuthenticated;
  const chatOpen = Boolean(chat?.isOpen) && !detailOpen;
  const showChat = chat !== undefined && !(chat.isOpen && detailOpen);
  const floatingComposer = showChat && !chatOpen;
  const panelOpen = detailOpen || chatOpen;

  const headerActions =
    isAuthenticated && settings ? (
      <Button variant="outline" size="sm" onClick={() => setShowSettings(true)}>
        <Settings2 size={14} aria-hidden />
        Settings
      </Button>
    ) : undefined;

  return (
    <>
      <PageShell.Header title="Discover" actionContent={headerActions} bordered />
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
      <div className="relative flex h-full min-h-0">
        <div className="relative flex min-h-0 min-w-0 flex-1">
          <div
            data-header-scroll-source
            className={cn("min-h-0 min-w-0 flex-1 overflow-y-auto", panelOpen && "hidden lg:block")}
            onScroll={(event: UIEvent<HTMLDivElement>) =>
              setScrolled(event.currentTarget.scrollTop > SCROLLED_THRESHOLD)
            }
          >
            <div
              className="@container/discover flex w-full flex-col gap-10 px-4 pt-6 pb-12 sm:px-6 lg:px-16 lg:pt-8"
              style={
                floatingComposer && composerHeight
                  ? { paddingBottom: composerHeight + COMPOSER_CLEARANCE }
                  : undefined
              }
            >
              <DiscoverMasthead today={today} greeting={greeting}>
                {edition ? <DiscoverBrief lines={edition.brief} /> : null}
              </DiscoverMasthead>
              <DiscoverEditionBody controller={controller} />
            </div>
          </div>
          {showChat ? (
            <div
              data-composer-suggestions={!chatOpen && scrolled ? "hidden" : undefined}
              className={
                chatOpen ? PANEL_CLASS : cn(FLOATING_COMPOSER_CLASS, detailOpen && "hidden lg:flex")
              }
            >
              {chatOpen ? chat.header : null}
              <div
                ref={composerRef}
                className={
                  chatOpen
                    ? "min-h-0 flex-1"
                    : "pointer-events-auto mx-auto w-full max-w-[48rem] [&_[data-chat-input-shell]]:shadow-xl"
                }
              >
                {chat.thread}
              </div>
            </div>
          ) : null}
        </div>
        {detailOpen ? <DiscoverSidePanel controller={controller} /> : null}
      </div>
    </>
  );
}
