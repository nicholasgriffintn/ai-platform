import { Button, cn } from "@ngriffin_uk/polychat-component-ui";
import type { FlashcardsOutputContent, StudyProgress } from "@ngriffin_uk/polychat-schemas";
import { Check, ChevronLeft, ChevronRight, RotateCcw, X } from "lucide-react";
import { useState } from "react";

import { EMPTY_STUDY_PROGRESS, markFlashcard } from "./study-progress";

export interface FlashcardsViewProps {
  content: FlashcardsOutputContent;
  progress?: StudyProgress;
  onProgressChange?: (progress: StudyProgress) => void;
}

export function FlashcardsView({
  content,
  progress = EMPTY_STUDY_PROGRESS,
  onProgressChange,
}: FlashcardsViewProps) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const total = content.cards.length;
  const card = content.cards[Math.min(index, total - 1)];

  if (!card) {
    return null;
  }

  const move = (step: number) => {
    setFlipped(false);
    setIndex((current) => (current + step + total) % total);
  };

  const mark = (value: "known" | "missed") => {
    onProgressChange?.(markFlashcard(progress, index, value));
    move(1);
  };

  const status = progress.known.includes(index)
    ? "known"
    : progress.missed.includes(index)
      ? "missed"
      : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span className="tabular-nums">
          Card {index + 1} of {total}
        </span>
        <span className="tabular-nums">
          {progress.known.length} known · {progress.missed.length} to revisit
        </span>
      </div>
      <button
        type="button"
        onClick={() => setFlipped((current) => !current)}
        aria-label={flipped ? "Show the question" : "Show the answer"}
        className={cn(
          "flex min-h-56 w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border bg-surface px-8 py-10 text-center shadow-sm transition-colors",
          status === "known" && "border-success/50",
          status === "missed" && "border-attention/50",
          !status && "border-border",
        )}
      >
        <span className="polychat-eyebrow">{flipped ? "Answer" : "Question"}</span>
        <span className="text-xl leading-snug font-medium text-balance text-foreground">
          {flipped ? card.back : card.front}
        </span>
        {!flipped ? (
          <span className="text-xs text-muted-foreground">Tap to turn it over</span>
        ) : null}
      </button>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Previous card" onClick={() => move(-1)}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Next card" onClick={() => move(1)}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
        {onProgressChange ? (
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<X className="size-4" />}
              onClick={() => mark("missed")}
            >
              Not yet
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<Check className="size-4" />}
              onClick={() => mark("known")}
            >
              Got it
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Start again"
              title="Start again"
              onClick={() => {
                onProgressChange({ ...progress, known: [], missed: [] });
                setIndex(0);
                setFlipped(false);
              }}
            >
              <RotateCcw className="size-4" />
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
