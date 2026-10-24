import { AudioLines, RotateCcw } from "lucide-react";

import { cn } from "../utils";
import type { MediaStatus } from "./media-status";
import { MediaStatusChip } from "./MediaStatusChip";

export interface MediaTrackListItem {
  key: string;
  title: string;
  detail?: string;
  status: MediaStatus;
  active: boolean;
  onPlay?: () => void;
  onRetry?: () => void;
}

export function MediaTrackList({
  label,
  items,
}: {
  label: string;
  items: readonly MediaTrackListItem[];
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="polychat-eyebrow px-1">{label}</h3>
      <ol className="flex flex-col overflow-hidden rounded-2xl border border-border bg-surface">
        {items.map((item, index) => (
          <li key={item.key} className="border-b border-border last:border-b-0">
            <div
              className={cn("flex items-center gap-3 px-3 py-2.5", item.active && "bg-selection")}
            >
              <button
                type="button"
                disabled={!item.onPlay}
                onClick={item.onPlay}
                className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-default"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-canvas text-xs text-muted-foreground tabular-nums">
                  {item.active ? (
                    <AudioLines size={14} className="text-active-work" aria-hidden />
                  ) : (
                    index + 1
                  )}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span
                    className={cn(
                      "truncate text-sm",
                      item.onPlay ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {item.title}
                  </span>
                  {item.detail ? (
                    <span className="truncate text-xs text-muted-foreground">{item.detail}</span>
                  ) : null}
                </span>
              </button>
              {item.onRetry ? (
                <button
                  type="button"
                  onClick={item.onRetry}
                  className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-foreground hover:bg-selection"
                >
                  <RotateCcw size={12} aria-hidden />
                  Try again
                </button>
              ) : (
                <MediaStatusChip status={item.status} />
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
