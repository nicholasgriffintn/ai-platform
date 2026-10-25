import { MediaTile } from "@ngriffin_uk/polychat-component-ui";
import type { DiscoverCard } from "@ngriffin_uk/polychat-schemas";

import { WindDownScene } from "./media/WindDownScene.js";

export type DiscoverStoryCard = Extract<DiscoverCard, { kind: "wind_down" }>;

export const DISCOVER_STORY_MINUTES = 20;

export function DiscoverStoryTile({
  card,
  starting,
  failed,
  onStart,
}: {
  card: DiscoverStoryCard;
  starting: boolean;
  failed: boolean;
  onStart: (card: DiscoverStoryCard) => void;
}) {
  return (
    <MediaTile
      art={<WindDownScene bed="rain" seed={card.id} moving={false} />}
      eyebrow={`Tonight's story · ${card.topic}`}
      title={card.title}
      status={
        starting
          ? { state: "making", label: "Starting" }
          : failed
            ? { state: "failed", label: "Didn't start" }
            : { state: "ready", label: `${DISCOVER_STORY_MINUTES} min` }
      }
      selected={false}
      onSelect={() => onStart(card)}
    />
  );
}
