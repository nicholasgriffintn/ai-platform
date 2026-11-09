import { cn } from "@ngriffin_uk/polychat-component-ui";
import { ownsEscapeKey } from "@ngriffin_uk/polychat-utility-react";
import { AudioLines } from "lucide-react";
import { type RefObject, useEffect, useEffectEvent, useMemo } from "react";

import { DiscoverIdlePane } from "../DiscoverStates.js";
import type { DiscoverMedia } from "../media/media-status.js";
import type { DiscoverEditionController } from "../useDiscoverEditionController.js";
import { discoverItemKind } from "./discover-item-kind.js";
import {
  discoverItemKey,
  isDiscoverGraphItem,
  type DiscoverEditionItem,
  type DiscoverItem,
} from "./discover-items.js";
import { DiscoverGraphItemView } from "./DiscoverGraphItemView.js";
import { DiscoverItemHeader } from "./DiscoverItemHeader.js";
import { DiscoverItemView } from "./DiscoverItemView.js";

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

function StillPlaying({ media, onShow }: { media: DiscoverMedia; onShow: () => void }) {
  return (
    <button
      type="button"
      onClick={onShow}
      className="flex shrink-0 items-center gap-2 border-b border-border bg-surface px-5 py-2 text-left text-xs text-muted-foreground transition-colors hover:text-foreground"
    >
      <AudioLines size={14} className="text-active-work" aria-hidden />
      Still playing {MEDIA_LABELS[media]}
      <span className="ml-auto font-medium text-foreground">Back to it</span>
    </button>
  );
}

export function DiscoverItemPanel({
  controller,
  panelRef,
  playEntrance,
  open,
  shown,
  occupied,
}: {
  controller: DiscoverEditionController;
  panelRef: RefObject<HTMLElement | null>;
  playEntrance: (content: HTMLElement | null) => void;
  open: boolean;
  shown: DiscoverItem | null;
  occupied: boolean;
}) {
  const { panelEdition: edition, mediaPlaying, media, closePanel } = controller;
  const mediaEdition = controller.mediaEdition;
  const playingMedia = useMemo<DiscoverEditionItem>(() => ({ type: "media", media }), [media]);
  const overlaid = shown !== null && shown.type !== "media";
  const mediaItem =
    shown?.type === "media" ? shown : overlaid && mediaPlaying ? playingMedia : null;
  const cardItem = shown?.type === "card" ? shown : null;
  const graphItem = shown && isDiscoverGraphItem(shown) ? shown : null;
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
      ref={panelRef}
      aria-label="Discover item"
      inert={!open}
      className={cn(
        PANEL_CLASS,
        open ? PANEL_OPEN_CLASS : PANEL_CLOSED_CLASS,
        occupied ? PANEL_OCCUPIED_CLASS : "lg:w-0",
      )}
    >
      <div className="flex h-full min-h-0 w-full flex-col">
        {!edition && shown && !graphItem ? (
          <>
            <DiscoverItemHeader
              kind={discoverItemKind(shown)}
              navigation={{ position: null, onClose: closePanel }}
              pageHref={null}
            />
            <DiscoverIdlePane />
          </>
        ) : null}
        {mediaEdition && mediaItem ? (
          <div className={cn("flex min-h-0 flex-1 flex-col", overlaid && "hidden")}>
            <DiscoverItemView
              key={discoverItemKey(mediaItem)}
              item={mediaItem}
              edition={mediaEdition}
              controller={controller}
              playEntrance={playEntrance}
            />
          </div>
        ) : null}
        {edition && cardItem ? (
          <div className="flex min-h-0 flex-1 flex-col">
            {mediaPlaying ? <StillPlaying media={media} onShow={controller.showMedia} /> : null}
            <DiscoverItemView
              key={discoverItemKey(cardItem)}
              item={cardItem}
              edition={edition}
              controller={controller}
              playEntrance={playEntrance}
            />
          </div>
        ) : null}
        {graphItem ? (
          <div className="flex min-h-0 flex-1 flex-col">
            {mediaPlaying && mediaEdition ? (
              <StillPlaying media={media} onShow={controller.showMedia} />
            ) : null}
            <DiscoverGraphItemView
              key={discoverItemKey(graphItem)}
              item={graphItem}
              controller={controller}
              playEntrance={playEntrance}
            />
          </div>
        ) : null}
      </div>
    </aside>
  );
}
