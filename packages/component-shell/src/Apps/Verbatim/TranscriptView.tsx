import { cn } from "@ngriffin_uk/polychat-component-ui";
import type { VerbatimWord } from "@ngriffin_uk/polychat-schemas";
import { formatProbabilityPercent } from "@ngriffin_uk/polychat-utility-core";
import type { CSSProperties } from "react";

import { describeProbability, probabilityTone } from "../Decisions/probability.js";
import type { TranscriptEntry } from "./useLiveTranscript.js";
import { keyedWords } from "./words.js";

const WORD_STAGGER_MS = 12;

function inkStyle(probability: number, index: number): CSSProperties {
  return { opacity: 0.28 + probability * 0.72, animationDelay: `${index * WORD_STAGGER_MS}ms` };
}

function Word({ word, index }: { word: VerbatimWord; index: number }) {
  const enter =
    "motion-safe:animate-in motion-safe:fade-in-50 motion-safe:duration-300 motion-safe:fill-mode-both";

  if (word.removed) {
    return (
      <span
        className={cn(
          "font-sans text-[0.7em] text-failure/70 line-through decoration-failure decoration-2",
          enter,
        )}
        style={{ animationDelay: `${index * WORD_STAGGER_MS}ms` }}
        title="Struck out: Clef Omni could not hear this in the audio"
      >
        {word.text}
      </span>
    );
  }

  if (word.probability === null) {
    return <span className={enter}>{word.text}</span>;
  }

  const tone = probabilityTone(word.probability);

  return (
    <span
      className={cn(
        "transition-opacity",
        tone === "weak" && "underline decoration-failure decoration-wavy underline-offset-[6px]",
        tone === "middling" &&
          "underline decoration-attention/70 decoration-dotted decoration-2 underline-offset-[6px]",
        enter,
      )}
      style={inkStyle(word.probability, index)}
      title={`${formatProbabilityPercent(word.probability)} heard · ${describeProbability(word.probability).toLowerCase()}`}
    >
      {word.text}
    </span>
  );
}

export function TranscriptView({
  entries,
  live,
  listening,
  selectedId,
  onSelect,
}: {
  entries: readonly TranscriptEntry[];
  live: string;
  listening: boolean;
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  return (
    <p
      className="font-display text-[1.65rem] leading-[1.75] tracking-[-0.01em] text-foreground"
      aria-live="polite"
    >
      {entries.map((entry) => {
        if (entry.state === "pending") {
          return (
            <span key={entry.id} className="polychat-motion-shimmer italic">
              …{" "}
            </span>
          );
        }

        if (entry.state === "drafted") {
          return (
            <span
              key={entry.id}
              className="polychat-motion-shimmer px-1 motion-safe:animate-in motion-safe:duration-200 motion-safe:fade-in-0"
              title="Wet ink: transcribed, still being checked against the audio"
            >
              {entry.draft}{" "}
            </span>
          );
        }

        if (entry.state === "failed") {
          return (
            <span
              key={entry.id}
              className="mx-1 font-mono text-xs text-failure"
              title={entry.error}
            >
              [missed a phrase]{" "}
            </span>
          );
        }

        const { result } = entry;

        if (result.status === "silence") {
          return null;
        }

        if (result.status === "no_speech") {
          return (
            <span
              key={entry.id}
              className="mx-1 align-middle font-mono text-[11px] text-muted-foreground"
              title={`The transcriber heard “${result.rawText}”, but Clef Omni put speech at ${formatProbabilityPercent(result.speech)}`}
            >
              [phantom “{result.rawText}” ignored]{" "}
            </span>
          );
        }

        return (
          <button
            key={entry.id}
            type="button"
            onClick={() => onSelect(entry.id)}
            className={cn(
              "inline rounded-md [box-decoration-break:clone] px-1 text-left transition-colors duration-300",
              selectedId === entry.id
                ? "bg-accent-emerald/10 ring-1 ring-accent-emerald/25"
                : "hover:bg-selection/70",
            )}
          >
            {keyedWords(result.words).map(({ key, word, position }) => (
              <span key={key}>
                <Word word={word} index={position} />{" "}
              </span>
            ))}
          </button>
        );
      })}
      {live && (
        <span className="polychat-motion-shimmer px-1" title="Live: still speaking">
          {live}
        </span>
      )}
      {listening && (
        <span
          aria-hidden
          className="ml-0.5 inline-block h-[0.9em] w-[3px] translate-y-[0.12em] animate-pulse rounded-full bg-accent-emerald"
        />
      )}
    </p>
  );
}
