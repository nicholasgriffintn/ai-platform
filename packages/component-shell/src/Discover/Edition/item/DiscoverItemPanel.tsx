import { cn } from "@ngriffin_uk/polychat-component-ui";
import { ownsEscapeKey } from "@ngriffin_uk/polychat-utility-react";
import { AudioLines } from "lucide-react";
import { useEffect, useEffectEvent, useMemo } from "react";

import { DiscoverIdlePane } from "../DiscoverStates.js";
import type { DiscoverMedia } from "../media/media-status.js";
import type { DiscoverEditionController } from "../useDiscoverEditionController.js";
import { discoverItemKind } from "./discover-item-kind.js";
import { discoverItemKey, type DiscoverItem } from "./discover-items.js";
import { DiscoverItemHeader } from "./DiscoverItemHeader.js";
import { DiscoverItemView } from "./DiscoverItemView.js";
import type { DiscoverPanelMotion } from "./useDiscoverPanelMotion.js";

export const DISCOVER_PANEL_WIDTH = "lg:w-[26rem] xl:w-[34rem] 2xl:w-[40rem]";

const PANEL_CLASS =
  "absolute inset-0 z-20 flex min-h-0 flex-col overflow-hidden bg-background transition-[translate] lg:relative lg:inset-auto lg:z-auto lg:shrink-0 motion-reduce:transition-none";
const PANEL_OPEN_CLASS = "translate-x-0 duration-[360ms] ease-[cubic-bezier(.2,.8,.2,1)]";
const PANEL_CLOSED_CLASS =
  "pointer-events-none translate-x-full duration-[260ms] ease-[cubic-bezier(.4,0,1,1)]";
const PANEL_OCCUPIED_CLASS = `lg:border-l lg:border-border ${DISCOVER_PANEL_WIDTH}`;

const MEDIA_LABELS: Record<DiscoverMedia, string> = {
  episode: "today's episode",
  perch: "The Perch",
  week: "Your week",
  wind_down: "Wind down",
  story: "tonight's story",
};

export function DiscoverItemPanel({
  controller,
  motion,
}: {
  controller: DiscoverEditionController;
  motion: DiscoverPanelMotion;
}) {
  const { ownEdition: edition, mediaPlaying, media, closePanel } = controller;
  const { open, shown, occupied } = motion;
  const playingMedia = useMemo<DiscoverItem>(() => ({ type: "media", media }), [media]);
  const mediaItem =
    shown?.type === "media" ? shown : shown?.type === "card" && mediaPlaying ? playingMedia : null;
  const cardItem = shown?.type === "card" ? shown : null;
  const onEscape = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === "Escape" && !event.defaultPrevented && !ownsEscapeKey(event.target)) {
      closePanel();
    }
  });

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    window.addEventListener("keydown", onEscape);

    return () => window.removeEventListener("keydown", onEscape);
  }, [open]);

  return (
    <aside
      ref={motion.panelRef}
      aria-label="Discover item"
      inert={!open}
      className={cn(
        PANEL_CLASS,
        open ? PANEL_OPEN_CLASS : PANEL_CLOSED_CLASS,
        occupied ? PANEL_OCCUPIED_CLASS : "lg:w-0",
      )}
    >
      <div className="flex h-full min-h-0 w-full flex-col">
        {!edition && shown ? (
          <>
            <DiscoverItemHeader
              kind={discoverItemKind(shown)}
              navigation={{ position: null, onClose: closePanel }}
              pageHref={null}
            />
            <DiscoverIdlePane />
          </>
        ) : null}
        {edition && mediaItem ? (
          <div className={cn("flex min-h-0 flex-1 flex-col", cardItem && "hidden")}>
            <DiscoverItemView
              key={discoverItemKey(mediaItem)}
              item={mediaItem}
              edition={edition}
              controller={controller}
              playEntrance={motion.playEntrance}
            />
          </div>
        ) : null}
        {edition && cardItem ? (
          <div className="flex min-h-0 flex-1 flex-col">
            {mediaPlaying ? (
              <button
                type="button"
                onClick={controller.showMedia}
                className="flex shrink-0 items-center gap-2 border-b border-border bg-surface px-5 py-2 text-left text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <AudioLines size={14} className="text-active-work" aria-hidden />
                Still playing {MEDIA_LABELS[media]}
                <span className="ml-auto font-medium text-foreground">Back to it</span>
              </button>
            ) : null}
            <DiscoverItemView
              key={discoverItemKey(cardItem)}
              item={cardItem}
              edition={edition}
              controller={controller}
              playEntrance={motion.playEntrance}
            />
          </div>
        ) : null}
      </div>
    </aside>
  );
}
