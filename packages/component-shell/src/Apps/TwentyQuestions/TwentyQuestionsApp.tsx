import { Button, cn } from "@ngriffin_uk/polychat-component-ui";
import {
  twentyQuestionsCategories,
  type TwentyQuestionsCategory,
} from "@ngriffin_uk/polychat-schemas";
import { formatProbabilityPercent, reverseCopy } from "@ngriffin_uk/polychat-utility-core";
import { Apple, ArrowUp, Box, Flag, MapPin, PawPrint, RotateCcw } from "lucide-react";
import { type FormEvent, useState } from "react";

import {
  PROBABILITY_FILL_CLASS,
  describeProbability,
  probabilityTone,
} from "../Decisions/probability.js";
import { ProbabilityDial } from "../Decisions/ProbabilityDial.js";
import { type AskedQuestion, countedQuestions, useTwentyQuestions } from "./useTwentyQuestions.js";

const CATEGORIES: Record<
  TwentyQuestionsCategory,
  { label: string; icon: typeof Box; hint: string }
> = {
  animals: { label: "Animals", icon: PawPrint, hint: "Feathers optional" },
  food: { label: "Food", icon: Apple, hint: "Edible, mostly" },
  objects: { label: "Objects", icon: Box, hint: "Things you could trip over" },
  places: { label: "Places", icon: MapPin, hint: "Somewhere you could be" },
};

const WARMTH_STEPS = ["Freezing", "Cold", "Warm", "Hot", "Burning"];

function verdictFor(answer: AskedQuestion): string {
  if (answer.solved) {
    return "Got it";
  }

  if (answer.kind === "guess") {
    return "Not it";
  }

  if (answer.kind === "unanswerable") {
    return "Not a yes or no";
  }

  return describeProbability(answer.yes);
}

function CategoryPicker({
  busy,
  onPick,
}: {
  busy: boolean;
  onPick: (category: TwentyQuestionsCategory) => void;
}) {
  return (
    <div className="space-y-8">
      <div className="max-w-2xl space-y-2">
        <p className="font-display text-4xl leading-tight">I am thinking of something.</p>
        <p className="text-sm text-muted-foreground">
          The secret is sealed on the server. Ask yes or no questions and every answer comes back as
          a probability, so “probably not” is a clue rather than a shrug.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {twentyQuestionsCategories.map((category) => {
          const { label, icon: Icon, hint } = CATEGORIES[category];

          return (
            <button
              key={category}
              type="button"
              disabled={busy}
              onClick={() => onPick(category)}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 text-left transition-[border-color,transform] duration-300 hover:-translate-y-1 hover:border-accent-violet/60 disabled:opacity-60"
            >
              <span
                aria-hidden
                className="absolute -right-3 -bottom-10 font-display text-[9rem] leading-none text-accent-violet/10 italic transition-transform duration-500 group-hover:-rotate-12"
              >
                ?
              </span>
              <Icon size={22} className="text-accent-violet" />
              <span className="mt-8 block font-display text-2xl">{label}</span>
              <span className="text-xs text-muted-foreground">{hint}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Pips({ history, max }: { history: readonly AskedQuestion[]; max: number }) {
  const counted = history.filter((answer) => answer.kind !== "unanswerable");
  const slots = Array.from({ length: max }, (_, slot) => ({ slot, answer: counted[slot] }));

  return (
    <div className="flex flex-wrap gap-1.5">
      <span className="sr-only">{`${counted.length} of ${max} questions used`}</span>
      {slots.map(({ slot, answer }) => (
        <span
          key={`pip-${slot}`}
          title={answer?.question}
          className={cn(
            "size-3 rounded-full transition-colors duration-500",
            !answer && "border border-border-strong",
            answer?.kind === "guess" &&
              !answer.solved &&
              "bg-transparent ring-2 ring-failure ring-inset",
            answer?.solved && "bg-accent-violet",
            answer?.kind === "question" && PROBABILITY_FILL_CLASS[probabilityTone(answer.yes)],
          )}
        />
      ))}
    </div>
  );
}

function Thermometer({ level }: { level: number | null }) {
  return (
    <div className="space-y-1.5">
      <div className="relative h-2 rounded-full bg-[linear-gradient(90deg,var(--color-accent-blue),var(--color-accent-sky),var(--color-accent-amber),var(--color-accent-orange),var(--color-accent-red))]">
        {level !== null && (
          <span
            className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-foreground shadow transition-[left] duration-700 ease-out"
            style={{ left: `${(level / (WARMTH_STEPS.length - 1)) * 100}%` }}
          />
        )}
      </div>
      <div className="flex justify-between font-mono text-[10px] text-muted-foreground uppercase">
        <span>Freezing</span>
        <span className="text-foreground">{level === null ? "—" : WARMTH_STEPS[level]}</span>
        <span>Burning</span>
      </div>
    </div>
  );
}

export function TwentyQuestionsApp({ projectId }: { projectId?: string }) {
  const game = useTwentyQuestions(projectId);
  const [question, setQuestion] = useState("");
  const asked = countedQuestions(game.history);
  const max = game.game?.maxQuestions ?? 20;
  const latest = reverseCopy(game.history).find((answer) => answer.kind !== "unanswerable");
  const last = game.history.at(-1);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = question.trim();

    if (trimmed.length >= 2) {
      setQuestion("");
      void game.ask(trimmed);
    }
  };

  if (game.phase === "choosing") {
    return (
      <div className="space-y-3">
        <CategoryPicker busy={game.busy} onPick={(category) => void game.start(category)} />
        {game.error && <p className="text-sm text-failure">{game.error}</p>}
      </div>
    );
  }

  const category = game.game ? CATEGORIES[game.game.category].label : "";

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <div className="space-y-8 lg:sticky lg:top-4 lg:self-start">
        {game.phase === "playing" ? (
          <div className="flex flex-col items-center text-center">
            <span className="mb-2 font-mono text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
              {category} · question {Math.min(asked + 1, max)} of {max}
            </span>
            <ProbabilityDial
              size="lg"
              probability={last && last.kind === "question" ? last.yes : null}
            />
            <p
              key={last?.id ?? "start"}
              className="mt-3 font-display text-4xl leading-tight motion-safe:animate-in motion-safe:duration-500 motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2"
            >
              {last ? verdictFor(last) : "Ask away"}
            </p>
            <p className="mt-1 min-h-5 max-w-sm text-sm text-muted-foreground italic">
              {last
                ? `“${last.question}”`
                : "Start broad. “Is it alive?” is a classic for a reason."}
            </p>
          </div>
        ) : (
          <div className="space-y-4 text-center motion-safe:animate-in motion-safe:duration-500 motion-safe:fade-in-0 motion-safe:zoom-in-95">
            <span className="font-mono text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
              {game.phase === "won" ? `Solved in ${asked}` : "Twenty up"}
            </span>
            <p className="font-display text-2xl text-muted-foreground italic">It was</p>
            <p className="font-display text-5xl leading-tight">{game.secret}</p>
            <p className="text-sm text-muted-foreground">
              {game.phase === "won"
                ? asked <= 10
                  ? "Frankly suspicious. Well played."
                  : "Got there in the end."
                : "It happens to the best of us. Mostly to the rest of us."}
            </p>
            <Button variant="primary" icon={<RotateCcw size={16} />} onClick={game.reset}>
              Think of another
            </Button>
          </div>
        )}

        <div className="space-y-5">
          <Pips history={game.history} max={max} />
          <Thermometer level={latest ? latest.warmth.level : null} />
        </div>

        {game.phase === "playing" && (
          <form
            onSubmit={submit}
            className="flex items-center gap-2 rounded-full border border-border-strong bg-card py-1.5 pr-1.5 pl-5 transition-colors focus-within:border-accent-violet"
          >
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder={
                asked === 0 ? "Is it bigger than a breadbox?" : "Ask, or name your guess"
              }
              maxLength={200}
              disabled={game.busy}
              aria-label="Your yes or no question"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <Button
              type="submit"
              variant="primary"
              size="icon"
              aria-label="Ask"
              isLoading={game.busy}
              disabled={question.trim().length < 2}
              className="rounded-full"
            >
              <ArrowUp size={16} />
            </Button>
          </form>
        )}
        {game.error && <p className="text-sm text-failure">{game.error}</p>}
        {game.phase === "playing" && (
          <Button
            variant="outline"
            size="xs"
            disabled={game.busy}
            onClick={() => void game.giveUp()}
            icon={<Flag size={12} />}
          >
            Give up and reveal
          </Button>
        )}
      </div>

      <ol className="divide-y divide-border border-y border-border">
        {game.history.length === 0 && (
          <li className="py-10 text-center text-sm text-muted-foreground italic">
            The transcript of your interrogation will appear here.
          </li>
        )}
        {reverseCopy(game.history).map((answer) => (
          <li
            key={answer.id}
            className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-baseline gap-3 py-4 motion-safe:animate-in motion-safe:duration-300 motion-safe:fade-in-0 motion-safe:slide-in-from-top-2"
          >
            <span className="font-mono text-xs text-muted-foreground tabular-nums">
              {answer.kind === "unanswerable"
                ? "–"
                : countedQuestions(game.history.slice(0, answer.id + 1))}
            </span>
            <div className="min-w-0">
              <p className="font-display text-lg leading-snug">{answer.question}</p>
              <p
                className={cn(
                  "text-sm",
                  answer.kind === "unanswerable" ? "text-muted-foreground" : "text-foreground/80",
                )}
              >
                {verdictFor(answer)}
                {answer.kind !== "unanswerable" && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    · {answer.warmth.label.toLowerCase()}
                  </span>
                )}
              </p>
            </div>
            {answer.kind !== "unanswerable" && (
              <span
                className={cn(
                  "font-mono text-sm tabular-nums",
                  answer.solved ? "text-accent-violet" : "text-muted-foreground",
                )}
              >
                {formatProbabilityPercent(answer.yes)}
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
