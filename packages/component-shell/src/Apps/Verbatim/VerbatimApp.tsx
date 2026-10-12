import { Button, cn } from "@ngriffin_uk/polychat-component-ui";
import { formatProbabilityPercent } from "@ngriffin_uk/polychat-utility-core";
import { useCopyToClipboard } from "@ngriffin_uk/polychat-utility-react";
import { Check, Copy, Trash2 } from "lucide-react";
import { useState } from "react";

import { Readout } from "../Decisions/Readout.js";
import { LevelTrace } from "./LevelTrace.js";
import { RecordOrb } from "./RecordOrb.js";
import { SegmentInspector } from "./SegmentInspector.js";
import { summariseTranscript } from "./stats.js";
import { TranscriptView } from "./TranscriptView.js";
import { transcriptText, useLiveTranscript } from "./useLiveTranscript.js";

const percentOrDash = (value: number | null) =>
  value === null ? "—" : formatProbabilityPercent(value);

const LEGEND = [
  { label: "heard", opacity: 1, className: "" },
  {
    label: "unsure",
    opacity: 0.7,
    className:
      "underline decoration-attention/70 decoration-dotted decoration-2 underline-offset-4",
  },
  {
    label: "doubtful",
    opacity: 0.45,
    className: "underline decoration-failure decoration-wavy underline-offset-4",
  },
  { label: "struck", opacity: 0.7, className: "text-failure line-through decoration-2" },
];

function EmptyTranscript() {
  return (
    <div className="flex min-h-72 flex-col justify-center gap-4">
      <p className="font-display text-[1.65rem] leading-[1.75] text-muted-foreground/60">
        <span className="opacity-100">Every</span> <span className="opacity-90">word</span>{" "}
        <span className="opacity-80">you</span> <span className="opacity-70">say</span>{" "}
        <span className="opacity-60">lands</span> <span className="opacity-50">here</span>{" "}
        <span className="opacity-40">in</span> <span className="opacity-30">ink</span>{" "}
        <span className="opacity-25">as</span> <span className="opacity-20">firm</span>{" "}
        <span className="opacity-15">as</span> <span className="opacity-10">the</span>{" "}
        <span className="opacity-10">evidence.</span>
      </p>
      <p className="max-w-md text-sm text-muted-foreground">
        Press the button and talk normally. Each phrase is transcribed, then Clef Omni listens again
        and weighs every word against the audio. Anything it cannot hear is struck out.
      </p>
    </div>
  );
}

export function VerbatimApp({ projectId }: { projectId?: string }) {
  const transcript = useLiveTranscript(projectId);
  const { copied, copy } = useCopyToClipboard();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const stats = summariseTranscript(transcript.entries);
  const transcribed = transcript.entries.flatMap((entry) =>
    entry.state === "done" && entry.result.status === "transcribed"
      ? [{ id: entry.id, segment: entry.result, roundTripMs: entry.roundTripMs }]
      : [],
  );
  const inspected =
    transcribed.find((item) => item.id === selectedId) ?? transcribed[transcribed.length - 1];
  const listening = transcript.status === "listening";
  const pending = transcript.entries.filter(
    (entry) => entry.state === "pending" || entry.state === "drafted",
  ).length;

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="flex items-center gap-5 px-5 py-4">
          <RecordOrb
            listening={listening}
            starting={transcript.status === "starting"}
            level={transcript.level}
            onToggle={() => (listening ? transcript.stop() : void transcript.start())}
          />
          <div className="min-w-0 flex-1 space-y-1">
            <LevelTrace
              level={transcript.level}
              active={listening}
              markers={transcript.entries.length}
            />
            <div className="flex items-center gap-2 font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  listening ? "animate-pulse bg-accent-emerald" : "bg-border-strong",
                )}
              />
              {listening ? "Listening" : transcript.status === "starting" ? "Warming up" : "Idle"}
              <span className="text-border-strong">/</span>
              {pending > 0 ? `${pending} in review` : `${transcribed.length} phrases`}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-px border-t border-border bg-border sm:grid-cols-3 xl:grid-cols-6">
          {[
            { label: "Words", value: String(stats.words) },
            { label: "Mean ink", value: percentOrDash(stats.meanWordProbability) },
            { label: "Verbatim", value: percentOrDash(stats.meanVerbatim) },
            { label: "Fluent", value: percentOrDash(stats.meanFluent) },
            { label: "Struck / phantoms", value: `${stats.struckWords} / ${stats.phantoms}` },
            {
              label: "Settled",
              value:
                stats.meanRoundTripMs === null
                  ? "—"
                  : `${(stats.meanRoundTripMs / 1000).toFixed(1)}s`,
            },
          ].map((stat) => (
            <Readout
              key={stat.label}
              label={stat.label}
              value={stat.value}
              className="bg-surface px-5 py-3"
            />
          ))}
        </div>
      </div>

      {transcript.error && (
        <p role="alert" className="text-sm text-failure">
          {transcript.error}
        </p>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <article className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
            <ul className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              {LEGEND.map((item) => (
                <li key={item.label} className="flex items-center gap-1.5">
                  <span
                    className={cn("font-display text-sm text-foreground", item.className)}
                    style={{ opacity: item.opacity }}
                  >
                    word
                  </span>
                  {item.label}
                </li>
              ))}
            </ul>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="xs"
                icon={copied ? <Check size={14} /> : <Copy size={14} />}
                disabled={stats.words === 0}
                onClick={() => copy(transcriptText(transcript.entries))}
              >
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button
                variant="ghost"
                size="xs"
                icon={<Trash2 size={14} />}
                disabled={transcript.entries.length === 0 || listening}
                onClick={() => {
                  setSelectedId(null);
                  transcript.clear();
                }}
              >
                Clear
              </Button>
            </div>
          </div>
          {transcript.entries.length === 0 && !transcript.live ? (
            <EmptyTranscript />
          ) : (
            <TranscriptView
              entries={transcript.entries}
              live={transcript.live}
              listening={listening}
              selectedId={inspected?.id ?? null}
              onSelect={setSelectedId}
            />
          )}
        </article>

        <aside className="lg:sticky lg:top-4 lg:self-start">
          {inspected ? (
            <SegmentInspector segment={inspected.segment} roundTripMs={inspected.roundTripMs} />
          ) : (
            <div className="space-y-2 border-l-2 border-accent-emerald/40 pl-4 text-sm text-muted-foreground">
              <p className="font-display text-lg text-foreground italic">The inspector</p>
              <p>
                Pick any phrase to see how sure Clef Omni was, how it sounded, what it struck and
                where the milliseconds went.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
