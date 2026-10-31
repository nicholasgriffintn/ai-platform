import { Button, cn } from "@ngriffin_uk/polychat-component-ui";
import { formatTranscriptTimestamp } from "@ngriffin_uk/polychat-utility-core";
import type { MediaTrack } from "@ngriffin_uk/polychat-utility-react";
import { ChevronDown, ChevronUp, LoaderCircle, Pause, Play } from "lucide-react";
import { useState, type ReactNode } from "react";

import { riseIn } from "./discover-motion.js";
import { DiscoverItemThumb } from "./DiscoverItemThumb.js";
import type { DiscoverItemSummary } from "./useDiscoverItemSummary.js";

export type DiscoverItemTransport = Pick<
  MediaTrack,
  "playing" | "buffering" | "currentTime" | "duration" | "toggle"
>;

function PlaybackIcon({ transport }: { transport: DiscoverItemTransport }) {
  if (transport.buffering) {
    return <LoaderCircle size={13} className="animate-spin" aria-hidden />;
  }

  return transport.playing ? (
    <Pause size={13} fill="currentColor" aria-hidden />
  ) : (
    <Play size={13} fill="currentColor" className="translate-x-px" aria-hidden />
  );
}

function MiniTransport({ transport }: { transport: DiscoverItemTransport }) {
  const progress =
    transport.duration > 0 ? Math.min(100, (transport.currentTime / transport.duration) * 100) : 0;

  return (
    <div className="flex items-center gap-2">
      <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-border">
        <div
          className="h-full bg-foreground transition-[width] duration-200 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="font-mono text-[0.6875rem] text-muted-foreground tabular-nums">
        {formatTranscriptTimestamp(transport.currentTime)}
      </span>
    </div>
  );
}

function CompactRow({
  summary,
  transport,
  expanded,
  onToggle,
}: {
  summary: DiscoverItemSummary;
  transport: DiscoverItemTransport | null;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      ref={riseIn}
      className="flex items-center gap-3 rounded-xl border border-border bg-surface p-2"
    >
      <DiscoverItemThumb art={summary.art} className="size-11 rounded-lg text-sm" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="truncate text-sm font-medium text-foreground">{summary.title}</p>
        {transport ? (
          <MiniTransport transport={transport} />
        ) : (
          <p className="truncate text-xs text-muted-foreground">{summary.kicker}</p>
        )}
      </div>
      {transport ? (
        <button
          type="button"
          aria-label={transport.playing ? "Pause" : "Play"}
          onClick={transport.toggle}
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-foreground text-canvas transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-active-work focus-visible:outline-none"
        >
          <PlaybackIcon transport={transport} />
        </button>
      ) : null}
      <Button variant="ghost" size="xs" aria-expanded={expanded} onClick={onToggle}>
        {expanded ? "Hide" : "Show"}
        {expanded ? <ChevronUp size={13} aria-hidden /> : <ChevronDown size={13} aria-hidden />}
      </Button>
    </div>
  );
}

export function DiscoverItemLead({
  summary,
  transport = null,
  chatting,
  children,
}: {
  summary: DiscoverItemSummary;
  transport?: DiscoverItemTransport | null;
  chatting: boolean;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      {chatting ? (
        <div className="px-4 pt-3 pb-2 sm:px-6">
          <CompactRow
            summary={summary}
            transport={transport}
            expanded={expanded}
            onToggle={() => setExpanded((current) => !current)}
          />
        </div>
      ) : null}
      <div
        className={cn(
          chatting &&
            "max-h-[min(55vh,36rem)] [scrollbar-gutter:stable] overflow-y-auto border-b border-border",
          chatting && !expanded && "hidden",
        )}
      >
        <div className="px-4 pt-5 pb-6 sm:px-6">{children}</div>
      </div>
    </>
  );
}
