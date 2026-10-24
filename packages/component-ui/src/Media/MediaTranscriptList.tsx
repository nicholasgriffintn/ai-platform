import { formatTranscriptTimestamp } from "@ngriffin_uk/polychat-utility-core";

import { cn } from "../utils";
import type { MediaTranscript } from "./media-status";

export function currentTranscriptIndex(transcript: MediaTranscript, seconds: number): number {
  return transcript.segments.filter((segment) => (segment.start ?? 0) <= seconds).length - 1;
}

export function MediaTranscriptList({
  transcript,
  activeIndex,
  onSeek,
}: {
  transcript: MediaTranscript;
  activeIndex: number;
  onSeek: (seconds: number) => void;
}) {
  const speakers = transcript.speakers ?? {};

  return (
    <section className="flex flex-col gap-2">
      <h3 className="polychat-eyebrow px-1">Transcript</h3>
      <ol className="flex flex-col gap-0.5">
        {transcript.segments.map((segment, index) => (
          <li key={`${segment.start ?? "x"}:${segment.text.slice(0, 24)}`}>
            <button
              type="button"
              disabled={segment.start === undefined}
              onClick={() => onSeek(segment.start ?? 0)}
              className={cn(
                "flex w-full gap-3 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-selection disabled:cursor-default disabled:hover:bg-transparent",
                index === activeIndex && "bg-selection",
              )}
            >
              <span className="w-10 shrink-0 pt-px text-xs text-muted-foreground tabular-nums">
                {segment.start === undefined ? "" : formatTranscriptTimestamp(segment.start)}
              </span>
              <span className="min-w-0 text-muted-foreground">
                {segment.speaker ? (
                  <span className="font-medium text-foreground">
                    {speakers[segment.speaker] ?? segment.speaker}:{" "}
                  </span>
                ) : null}
                {segment.text}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
