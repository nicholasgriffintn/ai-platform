import { Button, cn, LoadingSpinner } from "@ngriffin_uk/polychat-component-ui";
import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import { getErrorMessage, partOfDay } from "@ngriffin_uk/polychat-utility-core";
import { useElementSize } from "@ngriffin_uk/polychat-utility-react";
import { Settings2 } from "lucide-react";
import { useLayoutEffect, useRef, useState, type ReactNode, type UIEvent } from "react";

import { PageShell } from "../../Shell/PageShell.js";
import { DiscoverBrief } from "./DiscoverBrief.js";
import { DiscoverFeed } from "./DiscoverFeed.js";
import { DiscoverMasthead, type DiscoverGreeting } from "./DiscoverMasthead.js";
import { DiscoverMediaShelf } from "./DiscoverMediaShelf.js";
import { DiscoverSettingsDialog } from "./DiscoverSettingsDialog.js";
import { DiscoverNoEdition, DiscoverPreparing, DiscoverTurnOn } from "./DiscoverStates.js";
import { slideInPanel } from "./item/discover-motion.js";
import { DISCOVER_PANEL_WIDTH, DiscoverItemPanel } from "./item/DiscoverItemPanel.js";
import { useDiscoverPanelMotion } from "./item/useDiscoverPanelMotion.js";
import {
  useDiscoverEditionController,
  type DiscoverEditionController,
} from "./useDiscoverEditionController.js";

const REFRESH_MESSAGES = {
  blocked: "Discover can't run right now. Check your Scheduled page.",
  paused: "Discover is paused. Turn it back on in settings.",
  not_enabled: "Turn Discover on first.",
} as const;

const CHAT_PANEL_CLASS = `absolute inset-0 z-20 flex min-h-0 flex-col bg-background lg:static lg:inset-auto lg:z-auto lg:shrink-0 lg:border-l lg:border-border ${DISCOVER_PANEL_WIDTH}`;

const FLOATING_COMPOSER_CLASS =
  "pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col pt-24 pb-2 transition-[opacity,translate] duration-200 ease-[cubic-bezier(.2,.8,.2,1)] [background:linear-gradient(to_top,var(--background)_calc(100%-6rem),transparent)] sm:px-6 sm:pb-4 motion-reduce:transition-none";

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

function DiscoverEditionBody({ controller }: { controller: DiscoverEditionController }) {
  const { edition, ownEdition, settings, selectedCard, isAuthenticated } = controller;
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
      mediaCount={ownEdition && settings ? controller.mediaShelf.length : 0}
      media={
        ownEdition && settings ? (
          <DiscoverMediaShelf
            edition={ownEdition}
            media={controller.mediaShelf}
            awaitingEpisode={controller.isAwaitingEpisode}
            windDownId={controller.windDownId}
            active={controller.panelItem?.type === "media" ? controller.media : null}
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

export function DiscoverEditionView({ chat }: { chat?: DiscoverChatSlot }) {
  const controller = useDiscoverEditionController();
  const [showSettings, setShowSettings] = useState(false);
  const greeting = useGreeting();
  const [today] = useState(todayLine);
  const { ref: composerRef, height: composerHeight } = useElementSize<HTMLDivElement>();
  const [scrolled, setScrolled] = useState(false);
  const motion = useDiscoverPanelMotion(controller.panelItem);
  const chatPanelRef = useRef<HTMLDivElement>(null);
  const chatPanelOpen = Boolean(chat?.isOpen) && controller.panelItem === null;

  useLayoutEffect(() => {
    if (chatPanelOpen) {
      slideInPanel(chatPanelRef.current);
    }
  }, [chatPanelOpen]);

  const { discover, edition, ownEdition, settings, isAuthenticated } = controller;
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

  const detailOpen = controller.panelItem !== null;
  const chatOpen = chatPanelOpen;
  const showChat = chat !== undefined && !(chat.isOpen && detailOpen);
  const floatingComposer = showChat && !chatOpen;
  const panelOpen = detailOpen || chatOpen;

  const headerActions =
    isAuthenticated && settings ? (
      <Button
        variant="outline"
        size="sm"
        collapseLabel
        icon={<Settings2 size={14} aria-hidden />}
        aria-label="Discover settings"
        title="Discover settings"
        onClick={() => setShowSettings(true)}
      >
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
      <div className="relative flex h-full min-h-0 overflow-hidden">
        <div className="relative flex min-h-0 min-w-0 flex-1">
          <div
            ref={motion.feedRef}
            data-header-scroll-source
            className={cn("min-h-0 min-w-0 flex-1 overflow-y-auto", panelOpen && "hidden lg:block")}
            onClickCapture={(event) => motion.capture(event.target)}
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
              ref={chatPanelRef}
              data-composer-suggestions={!chatOpen && scrolled ? "hidden" : undefined}
              inert={detailOpen}
              className={
                chatOpen
                  ? CHAT_PANEL_CLASS
                  : cn(FLOATING_COMPOSER_CLASS, detailOpen && "translate-y-6 opacity-0")
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
        <DiscoverItemPanel controller={controller} motion={motion} />
      </div>
    </>
  );
}
