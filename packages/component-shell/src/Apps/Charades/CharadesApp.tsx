import { Button, cn } from "@ngriffin_uk/polychat-component-ui";
import { Clapperboard, Layers, Shuffle } from "lucide-react";

import { DeckPicker } from "./DeckPicker.js";
import { PlayingCard } from "./PlayingCard.js";
import { Stage } from "./Stage.js";
import { useCharadesGame } from "./useCharadesGame.js";
import { useClipRecorder } from "./useClipRecorder.js";
import { Verdict } from "./Verdict.js";

function Ticket({ score, rounds }: { score: number; rounds: number }) {
  return (
    <div className="relative flex overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex-1 px-5 py-4">
        <div className="text-[11px] tracking-[0.08em] text-muted-foreground uppercase">Score</div>
        <div className="font-mono text-4xl leading-none tabular-nums">{score}</div>
      </div>
      <div className="border-l-2 border-dashed border-border px-5 py-4 text-right">
        <div className="text-[11px] tracking-[0.08em] text-muted-foreground uppercase">Round</div>
        <div className="font-mono text-4xl leading-none tabular-nums">{rounds}</div>
      </div>
      <span className="absolute -top-2 right-[5.6rem] size-4 rounded-full border border-border bg-background" />
      <span className="absolute right-[5.6rem] -bottom-2 size-4 rounded-full border border-border bg-background" />
    </div>
  );
}

export function CharadesApp() {
  const game = useCharadesGame();
  const recorder = useClipRecorder();
  const busy = recorder.phase === "countdown" || recorder.phase === "recording" || game.judging;

  if (!game.deck) {
    return <DeckPicker onPick={game.chooseDeck} />;
  }

  const act = async () => {
    const clip = await recorder.record();

    if (clip) {
      await game.judge(clip);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-4">
        <Stage
          stream={recorder.stream}
          phase={recorder.phase}
          secondsLeft={recorder.secondsLeft}
          judging={game.judging}
          onOpenCamera={() => void recorder.openCamera()}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            size="lg"
            icon={<Clapperboard size={18} />}
            disabled={!recorder.stream || busy || Boolean(game.verdict)}
            onClick={() => void act()}
          >
            Action
          </Button>
          <Button
            variant="secondary"
            size="lg"
            icon={<Shuffle size={16} />}
            disabled={busy}
            onClick={game.nextCard}
          >
            {game.verdict ? "Next card" : "Deal another"}
          </Button>
          <Button
            variant="ghost"
            icon={<Layers size={16} />}
            disabled={busy}
            className="ml-auto"
            onClick={() => {
              recorder.closeCamera();
              game.leaveDeck();
            }}
          >
            Change deck
          </Button>
        </div>
        {(recorder.error ?? game.error) && (
          <p role="alert" className="text-sm text-failure">
            {recorder.error ?? game.error}
          </p>
        )}
        {game.rounds.length > 0 && (
          <ol className="flex flex-wrap gap-2">
            {game.rounds.map((round) => (
              <li
                key={round.id}
                className={cn(
                  "rounded-full border px-3 py-1 font-mono text-xs",
                  round.verdict.correct
                    ? "border-success/40 text-success"
                    : "border-border text-muted-foreground",
                )}
              >
                {round.card} +{round.verdict.points}
              </li>
            ))}
          </ol>
        )}
      </div>

      <aside className="space-y-6">
        <Ticket score={game.score} rounds={game.rounds.length} />
        <PlayingCard
          key={game.card}
          corner={game.deck.name}
          className="mx-auto w-56 -rotate-2 motion-safe:animate-in motion-safe:duration-500 motion-safe:fade-in-0 motion-safe:slide-in-from-right-8"
        >
          <span className="text-[11px] tracking-[0.08em] text-muted-foreground uppercase">
            Act out
          </span>
          <span className="mt-1 font-display text-3xl leading-tight italic">{game.card}</span>
        </PlayingCard>
        {game.verdict && game.card ? (
          <Verdict card={game.card} verdict={game.verdict} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Press Action, survive the countdown and perform. You score the probability the audience
            gives your card, plus a bonus if it is their top guess.
          </p>
        )}
      </aside>
    </div>
  );
}
