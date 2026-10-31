import { Play } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../utils";
import type { MediaStatus } from "./media-status";
import { MediaStatusChip } from "./MediaStatusChip";

export function MediaTile({
  art,
  eyebrow,
  title,
  status,
  selected,
  wide = false,
  onSelect,
}: {
  art: ReactNode;
  eyebrow: string;
  title: string;
  status: MediaStatus;
  selected: boolean;
  wide?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "group relative w-full overflow-hidden rounded-2xl bg-neutral-950 text-left ring-offset-2 ring-offset-canvas transition focus-visible:ring-2 focus-visible:ring-active-work focus-visible:outline-none active:scale-[.98] motion-reduce:active:scale-100",
        wide ? "aspect-video" : "aspect-[4/5]",
        selected && "ring-2 ring-active-work",
      )}
    >
      <span className="absolute inset-0 transition-transform duration-700 group-hover:scale-[1.04] motion-reduce:transition-none">
        {art}
      </span>
      <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
      <span className="absolute top-2.5 right-2.5 left-2.5 flex items-start justify-between gap-2">
        <MediaStatusChip status={status} tone="overlay" />
        {status.state === "ready" && (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-neutral-950 shadow transition-transform group-hover:scale-110">
            <Play size={14} fill="currentColor" className="translate-x-px" aria-hidden />
          </span>
        )}
      </span>
      <span className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 p-3">
        <span className="truncate text-[0.65rem] font-semibold tracking-[0.08em] text-white/75 uppercase">
          {eyebrow}
        </span>
        <span
          className={cn(
            "line-clamp-2 font-display leading-tight font-medium text-balance text-white",
            wide ? "text-xl" : "text-[1.05rem]",
          )}
        >
          {title}
        </span>
      </span>
    </button>
  );
}
