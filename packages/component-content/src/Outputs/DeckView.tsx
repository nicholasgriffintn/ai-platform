import { Button, cn } from "@ngriffin_uk/polychat-component-ui";
import type { DeckOutputContent, DeckSlide } from "@ngriffin_uk/polychat-schemas";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState, type KeyboardEvent } from "react";

import { MemoizedMarkdown } from "../markdown";

export interface DeckViewProps {
  content: DeckOutputContent;
  showNotes?: boolean;
}

function SlideBody({ slide }: { slide: DeckSlide }) {
  if (slide.layout === "quote") {
    return (
      <blockquote className="max-w-[80%] text-2xl leading-snug font-medium text-foreground">
        {slide.body ?? slide.bullets.join(" ")}
      </blockquote>
    );
  }

  return (
    <div className="flex w-full flex-col gap-4">
      {slide.bullets.length > 0 ? (
        <ul className="flex list-disc flex-col gap-2 pl-6 text-lg">
          {slide.bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      ) : null}
      {slide.body ? <MemoizedMarkdown>{slide.body}</MemoizedMarkdown> : null}
      {slide.columns ? (
        <div className="grid grid-cols-2 gap-6">
          <div className="min-w-0">
            <MemoizedMarkdown>{slide.columns[0] ?? ""}</MemoizedMarkdown>
          </div>
          <div className="min-w-0">
            <MemoizedMarkdown>{slide.columns[1] ?? ""}</MemoizedMarkdown>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function DeckView({ content, showNotes = false }: DeckViewProps) {
  const [index, setIndex] = useState(0);
  const total = content.slides.length;
  const slide = content.slides[Math.min(index, total - 1)];

  if (!slide) {
    return null;
  }

  const isOpening = slide.layout === "title" || slide.layout === "section";
  const move = (step: number) =>
    setIndex((current) => Math.min(total - 1, Math.max(0, current + step)));
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowRight" || event.key === "PageDown") {
      event.preventDefault();
      move(1);
    }

    if (event.key === "ArrowLeft" || event.key === "PageUp") {
      event.preventDefault();
      move(-1);
    }
  };

  return (
    <div className="flex flex-col gap-3" data-output-kind="deck">
      <section
        aria-roledescription="slide"
        aria-label={`Slide ${index + 1} of ${total}: ${slide.title}`}
        className={cn(
          "flex aspect-video w-full flex-col gap-5 overflow-hidden rounded-lg border border-border bg-surface-elevated p-[5%]",
          isOpening || slide.layout === "quote" ? "items-center justify-center text-center" : "",
        )}
      >
        <h3 className={cn("font-semibold text-foreground", isOpening ? "text-4xl" : "text-2xl")}>
          {slide.title}
        </h3>
        {slide.subtitle ? <p className="text-lg text-muted-foreground">{slide.subtitle}</p> : null}
        {isOpening ? null : <SlideBody slide={slide} />}
      </section>
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="icon"
          size="sm"
          onClick={() => move(-1)}
          onKeyDown={handleKeyDown}
          disabled={index === 0}
          aria-label="Previous slide"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-sm text-muted-foreground tabular-nums">
          {index + 1} / {total}
        </span>
        <Button
          variant="icon"
          size="sm"
          onClick={() => move(1)}
          onKeyDown={handleKeyDown}
          disabled={index === total - 1}
          aria-label="Next slide"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
      {showNotes && slide.notes ? (
        <aside className="rounded-md border border-border p-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Notes. </span>
          {slide.notes}
        </aside>
      ) : null}
    </div>
  );
}
