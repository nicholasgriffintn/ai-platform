import { Button, cn, LoadingSpinner } from "@ngriffin_uk/polychat-component-ui";
import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import { isDiscoverListenResearching } from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage, partOfDay } from "@ngriffin_uk/polychat-utility-core";
import { AudioLines, Settings2 } from "lucide-react";
import { useState } from "react";

import { PageShell } from "../../Shell/PageShell.js";
import { cardTopic, countTopicArticles } from "./discover-card-drafts.js";
import { DiscoverDetailPane } from "./DiscoverDetailPane.js";
import { DiscoverFeed } from "./DiscoverFeed.js";
import { DiscoverIntro } from "./DiscoverIntro.js";
import { DiscoverMediaShelf } from "./DiscoverMediaShelf.js";
import { DiscoverSettingsDialog } from "./DiscoverSettingsDialog.js";
import { DiscoverIdlePane, DiscoverNoEdition, DiscoverPreparing } from "./DiscoverStates.js";
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
  const { edition, media } = controller;
  const [openedAt] = useState(Date.now);

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

export function DiscoverEditionView() {
  const controller = useDiscoverEditionController();
  const [showSettings, setShowSettings] = useState(false);
  const greeting = useGreeting();
  const [today] = useState(todayLine);
  const { discover, edition, settings, selectedCard, view } = controller;
  const detailOpen = view !== "feed";

  if (discover.isLoading || !settings) {
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

  if (!settings.enabled && !edition) {
    return (
      <>
        <PageShell.Header title="Discover" />
        <div className="h-full overflow-y-auto px-4">
          <DiscoverIntro
            isWorking={controller.isSavingSettings || controller.isRefreshing}
            onTurnOn={() => void controller.turnOn()}
          />
        </div>
      </>
    );
  }

  const refreshMessage =
    controller.refreshStatus && controller.refreshStatus !== "queued"
      ? REFRESH_MESSAGES[controller.refreshStatus]
      : null;
  const headerActions = (
    <Button variant="outline" size="sm" onClick={() => setShowSettings(true)}>
      <Settings2 size={14} aria-hidden />
      Settings
    </Button>
  );

  return (
    <>
      <PageShell.Header title="Discover" actionContent={headerActions} />
      <DiscoverSettingsDialog
        open={showSettings}
        onOpenChange={setShowSettings}
        settings={settings}
        isSaving={controller.isSavingSettings}
        canWriteAgain={Boolean(edition)}
        isWriting={controller.isRefreshing || controller.isAwaitingEdition}
        onWriteAgain={() => void controller.writeEditionNow()}
        follows={controller.follows}
        onUnfollow={controller.unfollow}
        onToggle={controller.toggle}
        onUseSource={controller.useSource}
        onSaveCurate={controller.saveCurate}
        onSavePreferences={controller.savePreferences}
      />
      <div className="flex h-full min-h-0">
        <div
          className={cn(
            "w-full shrink-0 overflow-y-auto border-border px-4 pt-6 pb-10 lg:w-[26rem] lg:border-r lg:px-6",
            detailOpen && "hidden lg:block",
          )}
        >
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-1">
              <p className="polychat-eyebrow">{today}</p>
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
            {controller.isAwaitingEdition ? (
              <DiscoverPreparing />
            ) : edition ? (
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
                  <DiscoverMediaShelf
                    edition={edition}
                    showEpisode={settings.episode !== "off" || Boolean(edition.episodeId)}
                    awaitingEpisode={controller.isAwaitingEpisode}
                    windDownId={controller.windDownId}
                    active={view === "card" ? null : controller.media}
                    onOpen={controller.openMedia}
                  />
                }
              />
            ) : (
              <DiscoverNoEdition
                isRefreshing={controller.isRefreshing}
                onWriteNow={() => void controller.writeEditionNow()}
              />
            )}
          </div>
        </div>
        <div className={cn("relative min-w-0 flex-1", !detailOpen && "hidden lg:block")}>
          <div className={cn("h-full", selectedCard && "hidden")}>
            <DiscoverMediaPane controller={controller} />
          </div>
          {selectedCard && edition ? (
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
                  editionId={edition.id}
                  card={selectedCard}
                  topicArticleCount={countTopicArticles(edition.cards, cardTopic(selectedCard))}
                  signals={edition.feedback[selectedCard.id] ?? []}
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
        </div>
      </div>
    </>
  );
}
