import { cn } from "@ngriffin_uk/polychat-component-ui";
import { useDiscoverCover } from "@ngriffin_uk/polychat-library-react";
import { deriveProjectColour, type DiscoverCard } from "@ngriffin_uk/polychat-schemas";
import { useObjectUrl } from "@ngriffin_uk/polychat-utility-react";

import { HouseCover, isHouseCover } from "./house-covers.js";

type TopicCard = Extract<DiscoverCard, { kind: "topic" }>;

export function discoverTopicGradient(topic: string): string {
  const colour = deriveProjectColour(topic, "");
  const echo = deriveProjectColour(`${topic} echo`, "");

  return `radial-gradient(120% 90% at 85% 10%, ${echo}cc 0%, transparent 55%), radial-gradient(90% 70% at 10% 90%, ${colour} 0%, transparent 70%), linear-gradient(160deg, ${colour}ee 0%, #0f172a 100%)`;
}

export function DiscoverCover({ card, className }: { card: TopicCard; className?: string }) {
  const coverId = card.coverId;
  const houseCover = isHouseCover(coverId);
  const cover = useDiscoverCover(houseCover ? undefined : coverId);
  const url = useObjectUrl(cover.data);

  if (houseCover) {
    return <HouseCover coverId={coverId} className={className} />;
  }

  return url ? (
    <img src={url} alt="" className={cn("size-full object-cover", className)} />
  ) : (
    <div
      aria-hidden
      className={cn("size-full", card.coverId && "animate-pulse", className)}
      style={{ background: discoverTopicGradient(card.topic) }}
    />
  );
}

export function DiscoverTopicTile({
  card,
  selected,
  hidden,
  following,
  onSelect,
}: {
  card: TopicCard;
  selected: boolean;
  hidden: boolean;
  following: boolean;
  onSelect: (card: DiscoverCard) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect(card)}
      className={cn(
        "group relative aspect-[4/5] w-full overflow-hidden rounded-2xl text-left ring-offset-2 ring-offset-canvas transition focus-visible:ring-2 focus-visible:ring-active-work focus-visible:outline-none",
        selected && "ring-2 ring-active-work",
        hidden && "opacity-40 saturate-0",
      )}
    >
      <DiscoverCover
        card={card}
        className="absolute inset-0 transition-transform duration-500 group-hover:scale-[1.04] motion-reduce:transition-none"
      />
      {following && (
        <span className="absolute top-2 left-2 rounded-full bg-black/55 px-2 py-0.5 text-[0.65rem] font-medium text-white backdrop-blur">
          Following
        </span>
      )}
      <span className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-3 pt-12">
        <span className="text-[0.65rem] font-semibold tracking-[0.08em] text-white/75 uppercase">
          {card.topic}
        </span>
        <span className="font-display text-[1.05rem] leading-tight font-medium text-balance text-white">
          {card.title}
        </span>
      </span>
    </button>
  );
}
