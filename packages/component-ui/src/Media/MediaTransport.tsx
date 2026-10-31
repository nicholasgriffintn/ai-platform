import { formatTranscriptTimestamp } from "@ngriffin_uk/polychat-utility-core";
import type { MediaTrack } from "@ngriffin_uk/polychat-utility-react";
import { LoaderCircle, Pause, Play } from "lucide-react";
import type { ReactNode } from "react";

export interface MediaTransportProps {
  playing: boolean;
  busy?: boolean;
  disabled?: boolean;
  onToggle: () => void;
  value: number;
  max: number;
  onSeek?: (value: number) => void;
  start: string;
  end: string;
  caption?: ReactNode;
  actions?: ReactNode;
}

export function mediaPosition(track: Pick<MediaTrack, "currentTime" | "duration" | "seek">) {
  return {
    value: track.currentTime,
    max: track.duration,
    onSeek: track.seek,
    start: formatTranscriptTimestamp(track.currentTime),
    end: track.duration ? formatTranscriptTimestamp(track.duration) : "--:--",
  };
}

export function MediaTransport({
  playing,
  busy = false,
  disabled = false,
  onToggle,
  value,
  max,
  onSeek,
  start,
  end,
  caption,
  actions,
}: MediaTransportProps) {
  const progress = max > 0 ? Math.min(100, (value / max) * 100) : 0;

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        aria-label={playing ? "Pause" : "Play"}
        disabled={disabled}
        onClick={onToggle}
        className="flex size-12 shrink-0 items-center justify-center rounded-full bg-foreground text-canvas transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-active-work focus-visible:ring-offset-2 focus-visible:ring-offset-canvas focus-visible:outline-none disabled:opacity-40 disabled:hover:scale-100"
      >
        {busy ? (
          <LoaderCircle size={20} className="animate-spin" aria-hidden />
        ) : playing ? (
          <Pause size={20} fill="currentColor" aria-hidden />
        ) : (
          <Play size={20} fill="currentColor" className="translate-x-px" aria-hidden />
        )}
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {caption ? <div className="truncate text-sm text-foreground">{caption}</div> : null}
        <div className="relative flex h-3 items-center">
          <div className="h-1 w-full overflow-hidden rounded-full bg-selection">
            <div
              className="h-full rounded-full bg-foreground/80 transition-[width] duration-200 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
          <input
            type="range"
            aria-label="Position"
            min={0}
            max={max || 1}
            step="any"
            value={Math.min(value, max || 1)}
            disabled={disabled || !onSeek || max <= 0}
            onChange={(event) => onSeek?.(Number(event.currentTarget.value))}
            className="absolute inset-0 w-full cursor-pointer appearance-none bg-transparent opacity-0 disabled:cursor-default"
          />
        </div>
        <div className="flex justify-between text-[0.7rem] text-muted-foreground tabular-nums">
          <span>{start}</span>
          <span>{end}</span>
        </div>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
    </div>
  );
}
