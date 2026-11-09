import { cn } from "@ngriffin_uk/polychat-component-ui";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import { DISCOVER_CARD_SURFACE } from "./DiscoverFeedCard.js";

export function DiscoverCompactRow({
  kicker,
  title,
  lead,
  trailing,
  onOpen,
}: {
  kicker: ReactNode;
  title: string;
  lead?: ReactNode;
  trailing?: ReactNode;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(DISCOVER_CARD_SURFACE, "items-center gap-3 px-3.5 py-3")}
    >
      {lead}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-xs text-muted-foreground">{kicker}</span>
        <span className="line-clamp-2 text-sm leading-snug font-medium text-foreground">
          {title}
        </span>
      </span>
      {trailing}
      <ChevronRight
        size={15}
        aria-hidden
        className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
      />
    </button>
  );
}
