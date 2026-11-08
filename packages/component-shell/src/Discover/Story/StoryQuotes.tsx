import { getStoryEntityPath } from "@ngriffin_uk/polychat-library-react";
import type { StoryQuote } from "@ngriffin_uk/polychat-schemas";
import { Link } from "react-router";

import { DiscoverHref } from "../Edition/DiscoverHref.js";

function QuoteAttribution({ quote }: { quote: StoryQuote }) {
  return (
    <figcaption className="text-sm text-muted-foreground">
      {"— "}
      {quote.speakerEntityId ? (
        <Link
          to={getStoryEntityPath(quote.speakerEntityId)}
          className="underline underline-offset-2"
        >
          {quote.speaker}
        </Link>
      ) : (
        quote.speaker
      )}
      {quote.context ? `, ${quote.context}` : ""}
      {" · "}
      <DiscoverHref href={quote.url} className="underline underline-offset-2">
        {quote.outlet}
      </DiscoverHref>
    </figcaption>
  );
}

export function StoryQuotes({ quotes }: { quotes: readonly StoryQuote[] }) {
  return (
    <div className="flex flex-col gap-4">
      {quotes.map((quote) => (
        <figure key={quote.id} className="flex flex-col gap-1 border-l-2 border-border pl-4">
          <blockquote className="text-[0.95rem] leading-relaxed text-pretty text-foreground">
            {quote.text}
          </blockquote>
          <QuoteAttribution quote={quote} />
        </figure>
      ))}
    </div>
  );
}
