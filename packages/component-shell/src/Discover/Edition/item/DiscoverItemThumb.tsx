import { Favicon } from "@ngriffin_uk/polychat-component-content";
import { cn } from "@ngriffin_uk/polychat-component-ui";

import { DiscoverCover } from "../DiscoverTopicTile.js";
import { discoverItemKind } from "./discover-item-kind.js";
import type { DiscoverItemArt } from "./useDiscoverItemSummary.js";

export function DiscoverItemThumb({ art, className }: { art: DiscoverItemArt; className: string }) {
  const frame = cn("relative flex shrink-0 items-center justify-center overflow-hidden", className);

  if (art.type === "image") {
    return (
      <span aria-hidden className={frame} style={{ background: art.background }}>
        {art.image ? (
          <img
            src={art.image}
            alt=""
            crossOrigin="use-credentials"
            className="absolute inset-0 size-full object-cover"
          />
        ) : null}
      </span>
    );
  }

  const { card } = art;

  if (card.kind === "topic") {
    return (
      <span aria-hidden className={frame}>
        <DiscoverCover card={card} className="absolute inset-0" />
      </span>
    );
  }

  if (card.kind === "read" || (card.kind === "inbox" && card.url)) {
    return (
      <span
        aria-hidden
        className={cn(frame, "bg-selection font-display text-foreground uppercase")}
      >
        {card.source.slice(0, 1)}
        {card.url ? (
          <Favicon url={card.url} className="absolute inset-0 size-full bg-selection p-[18%]" />
        ) : null}
      </span>
    );
  }

  const Icon = discoverItemKind({ type: "card", card }).icon;

  return (
    <span aria-hidden className={cn(frame, "bg-selection text-active-work")}>
      <Icon className="size-1/2" />
    </span>
  );
}
