import { cn } from "@ngriffin_uk/polychat-component-ui";
import { formatProbabilityPercent } from "@ngriffin_uk/polychat-utility-core";

import { ProbabilityBar } from "../Decisions/ProbabilityBar.js";
import { StepScale } from "../Decisions/StepScale.js";
import type { CharadesVerdict } from "./judge.js";
import { DRAMA_LEVELS } from "./judge.js";

const SHOWN_GUESSES = 5;

function Stamp({ caught }: { caught: boolean }) {
  return (
    <span
      className={cn(
        "inline-block -rotate-6 rounded-md border-[3px] px-3 py-1 font-mono text-xs font-semibold tracking-[0.2em] uppercase motion-safe:animate-in motion-safe:delay-500 motion-safe:duration-300 motion-safe:fade-in-0 motion-safe:fill-mode-both motion-safe:zoom-in-150",
        caught ? "border-failure text-failure" : "border-success text-success",
      )}
    >
      {caught ? "Words heard · ½ points" : "Clean performance"}
    </span>
  );
}

export function Verdict({ card, verdict }: { card: string; verdict: CharadesVerdict }) {
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <p className="text-[11px] tracking-[0.08em] text-muted-foreground uppercase">
          The audience thinks
        </p>
        <p className="font-display text-3xl leading-tight italic">{verdict.topGuess}</p>
        <p className="text-sm text-muted-foreground">
          {verdict.correct
            ? "Spot on. Take a bow."
            : `You were doing “${card}”. It ranked ${verdict.secretRank} of ${verdict.guesses.length} at ${formatProbabilityPercent(verdict.secretProbability)}.`}
        </p>
      </div>
      <div className="space-y-3">
        {verdict.guesses.slice(0, SHOWN_GUESSES).map((guess, index) => (
          <ProbabilityBar
            key={guess.card}
            label={guess.card === card ? `${guess.card} ★` : guess.card}
            probability={guess.probability}
            highlighted={guess.card === card}
            fillClassName={guess.card === card ? "bg-accent-rose" : "bg-foreground/35"}
            delayMs={index * 120}
          />
        ))}
      </div>
      <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
        <Stamp caught={verdict.caughtTalking} />
        <span className="font-mono text-xs text-muted-foreground">
          talking {formatProbabilityPercent(verdict.talking)}
        </span>
      </div>
      <StepScale
        label="Drama"
        steps={DRAMA_LEVELS}
        active={DRAMA_LEVELS.indexOf(verdict.drama.label)}
        activeClassName="bg-accent-rose"
      />
    </div>
  );
}
