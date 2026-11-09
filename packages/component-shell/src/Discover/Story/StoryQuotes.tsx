import type { StoryQuote } from "@ngriffin_uk/polychat-schemas";

import { DiscoverHref } from "../Edition/DiscoverHref.js";

function QuoteSpeaker({
  quote,
  onOpenEntity,
}: {
  quote: StoryQuote;
  onOpenEntity: ((entityId: string) => void) | null;
}) {
  const entityId = quote.speakerEntityId;

  if (!entityId || !onOpenEntity) {
    return <span className="font-medium text-foreground">{quote.speaker}</span>;
  }

  return (
    <button
      type="button"
      onClick={() => onOpenEntity(entityId)}
      className="font-medium text-foreground underline decoration-border underline-offset-2 transition-colors hover:decoration-foreground"
    >
      {quote.speaker}
    </button>
  );
}

export function StoryQuotes({
  quotes,
  onOpenEntity = null,
}: {
  quotes: readonly StoryQuote[];
  onOpenEntity?: ((entityId: string) => void) | null;
}) {
  return (
    <div className="flex flex-col gap-4">
      {quotes.map((quote) => (
        <figure key={quote.id} className="flex flex-col gap-1.5 border-l-2 border-border pl-4">
          <blockquote className="font-display text-base leading-relaxed text-pretty text-foreground">
            {quote.text}
          </blockquote>
          <figcaption className="text-xs leading-relaxed text-muted-foreground">
            <QuoteSpeaker quote={quote} onOpenEntity={onOpenEntity} />
            {quote.context ? `, ${quote.context}` : ""}
            {" · "}
            <DiscoverHref href={quote.url} className="underline underline-offset-2">
              {quote.outlet}
            </DiscoverHref>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
