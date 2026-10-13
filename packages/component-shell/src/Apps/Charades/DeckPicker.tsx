import { CHARADES_DECKS, type CharadesDeck } from "./decks.js";
import { CardBack, PlayingCard } from "./PlayingCard.js";

const TILTS = ["-rotate-3", "rotate-2", "-rotate-1", "rotate-3"];

export function DeckPicker({ onPick }: { onPick: (deck: CharadesDeck) => void }) {
  return (
    <div className="space-y-8">
      <div className="max-w-2xl space-y-2">
        <p className="font-display text-3xl leading-tight">
          Six seconds, one card, an audience of one decision model.
        </p>
        <p className="text-sm text-muted-foreground">
          Sound effects are allowed. Words are not, and it is listening to the soundtrack too.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
        {CHARADES_DECKS.map((deck, index) => (
          <button
            key={deck.id}
            type="button"
            onClick={() => onPick(deck)}
            className="group relative text-left focus-visible:outline-none"
          >
            <CardBack
              className={`absolute inset-0 translate-x-2 translate-y-2 ${TILTS[(index + 1) % 4]} opacity-80`}
            />
            <PlayingCard
              corner={`${deck.cards.length} cards`}
              className={`relative transition-transform duration-300 ease-out group-hover:-translate-y-2 group-hover:rotate-0 group-focus-visible:ring-2 group-focus-visible:ring-ring ${TILTS[index % 4]}`}
            >
              <span className="font-display text-2xl leading-tight italic">{deck.name}</span>
              <span className="mt-3 line-clamp-2 text-xs text-muted-foreground">
                {deck.cards.slice(0, 3).join(" · ")}…
              </span>
            </PlayingCard>
          </button>
        ))}
      </div>
    </div>
  );
}
