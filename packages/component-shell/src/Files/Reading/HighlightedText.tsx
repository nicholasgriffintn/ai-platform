import { highlightSegments } from "./reading.js";

export function HighlightedText({
  text,
  spans,
}: {
  text: string;
  spans: readonly [number, number][];
}) {
  return (
    <p className="max-h-64 overflow-y-auto font-mono text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
      {highlightSegments(text, spans).map((segment) =>
        segment.marked ? (
          <mark
            key={segment.start}
            className="rounded-[3px] bg-accent-sky/20 px-0.5 text-foreground decoration-accent-sky/60"
          >
            {segment.text}
          </mark>
        ) : (
          <span key={segment.start}>{segment.text}</span>
        ),
      )}
    </p>
  );
}
