import { cn } from "@ngriffin_uk/polychat-component-ui";
import type { VerbatimSegment } from "@ngriffin_uk/polychat-schemas";
import { formatProbabilityPercent } from "@ngriffin_uk/polychat-utility-core";
import type { ReactNode } from "react";

import { ProbabilityDial } from "../Decisions/ProbabilityDial.js";
import { StepScale } from "../Decisions/StepScale.js";
import { keyedWords } from "./words.js";

type TranscribedSegment = Extract<VerbatimSegment, { status: "transcribed" }>;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 border-t border-border pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-[11px] tracking-[0.08em] text-muted-foreground uppercase">{title}</h3>
      {children}
    </section>
  );
}

function TimingStack({
  segment,
  roundTripMs,
}: {
  segment: TranscribedSegment;
  roundTripMs: number;
}) {
  const { transcribeMs, decideMs, repairMs } = segment.timings;
  const network = Math.max(0, roundTripMs - transcribeMs - decideMs - repairMs);
  const parts = [
    { label: "Transcribe", ms: transcribeMs, className: "bg-foreground/70" },
    { label: "Judge", ms: decideMs, className: "bg-accent-emerald" },
    { label: "Repair", ms: repairMs, className: "bg-attention" },
    { label: "Network", ms: network, className: "bg-border-strong" },
  ].filter((part) => part.ms > 0);
  const total = parts.reduce((sum, part) => sum + part.ms, 0) || 1;

  return (
    <div className="space-y-2">
      <div className="flex h-2 overflow-hidden rounded-full bg-border">
        {parts.map((part) => (
          <span
            key={part.label}
            className={cn("h-full transition-[width] duration-500", part.className)}
            style={{ width: `${(part.ms / total) * 100}%` }}
          />
        ))}
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs">
        {parts.map((part) => (
          <div key={part.label} className="flex items-center justify-between gap-2">
            <dt className="flex items-center gap-1.5 text-muted-foreground">
              <span className={cn("size-1.5 rounded-full", part.className)} />
              {part.label}
            </dt>
            <dd className="tabular-nums">{Math.round(part.ms)}ms</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function RepairDiff({ segment }: { segment: TranscribedSegment }) {
  const { repair } = segment;

  if (!repair) {
    return (
      <p className="text-sm text-muted-foreground">
        Every word cleared the bar. Nothing to strike.
      </p>
    );
  }

  return (
    <div className="space-y-2 text-sm">
      <p className="leading-relaxed">
        {keyedWords(segment.words).map(({ key, word }) => (
          <span key={key} className={cn(word.removed && "text-failure line-through decoration-2")}>
            {word.text}{" "}
          </span>
        ))}
      </p>
      <div className="flex justify-between font-mono text-xs text-muted-foreground">
        <span>as heard {formatProbabilityPercent(repair.keptProbability)}</span>
        <span className={cn(repair.applied ? "text-failure" : "text-success")}>
          {repair.applied ? "struck" : "kept"} · best {formatProbabilityPercent(repair.probability)}
        </span>
      </div>
    </div>
  );
}

export function SegmentInspector({
  segment,
  roundTripMs,
}: {
  segment: TranscribedSegment;
  roundTripMs: number;
}) {
  const { checks, delivery } = segment;

  return (
    <div className="space-y-5 motion-safe:animate-in motion-safe:duration-300 motion-safe:fade-in-0">
      <Section title="Against the audio">
        <div className="grid grid-cols-2 gap-x-2 gap-y-3">
          <ProbabilityDial size="sm" probability={checks.speech} label="Speech" />
          <ProbabilityDial size="sm" probability={checks.verbatim} label="Word for word" />
          <ProbabilityDial size="sm" probability={checks.fluent} label="Fluent English" />
          <ProbabilityDial size="sm" probability={checks.coherent} label="Follows on" />
        </div>
      </Section>

      <Section title="Delivery">
        <StepScale
          label="Pace"
          steps={delivery.pace.scale}
          active={delivery.pace.scale.indexOf(delivery.pace.label)}
          activeClassName="bg-accent-emerald"
        />
        <StepScale
          label="Background"
          steps={delivery.noise.scale}
          active={delivery.noise.scale.indexOf(delivery.noise.label)}
          activeClassName="bg-accent-emerald"
        />
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-muted-foreground">Tone</span>
          <span>
            <span className="font-display text-base italic">{delivery.tone.label}</span>{" "}
            <span className="font-mono text-xs text-muted-foreground">
              {formatProbabilityPercent(delivery.tone.score)}
            </span>
          </span>
        </div>
      </Section>

      <Section title="Strike-outs">
        <RepairDiff segment={segment} />
      </Section>

      <Section title="Where the time went">
        <TimingStack segment={segment} roundTripMs={roundTripMs} />
        <p className="font-mono text-[11px] text-muted-foreground">
          {segment.usage.input_tokens.toLocaleString()} tokens · {segment.model}
        </p>
      </Section>
    </div>
  );
}
