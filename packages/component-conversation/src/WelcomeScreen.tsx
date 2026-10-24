import { MemoizedMarkdown } from "@ngriffin_uk/polychat-component-content";
import { cn } from "@ngriffin_uk/polychat-component-ui";
import { getPetSpriteHeight } from "@ngriffin_uk/polychat-schemas";
import type { ReactNode } from "react";

export const WELCOME_PET_SIZE = 128;

export interface WelcomeOpening {
  label: string;
  markdown: string;
}

export interface WelcomeScreenProps {
  title?: string;
  description?: string;
  opening?: WelcomeOpening;
  isLoading?: boolean;
  pet: ReactNode;
  suggestions: ReactNode;
}

function OpeningMessage({
  opening,
  pet,
  suggestions,
}: {
  opening: WelcomeOpening;
  pet: ReactNode;
  suggestions: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 pt-4 pb-2 text-left">
      <div className="flex items-end gap-3">
        <div className="shrink-0">{pet}</div>
        <p className="polychat-eyebrow pb-2">{opening.label}</p>
      </div>
      <div className="polychat-motion-enter prose max-w-none text-foreground dark:prose-invert">
        <MemoizedMarkdown>{opening.markdown}</MemoizedMarkdown>
      </div>
      <p className="polychat-motion-enter polychat-motion-stagger-1 pt-2 text-sm text-muted-foreground">
        Start with one of these, or say what you have in mind.
      </p>
      {suggestions}
    </div>
  );
}

export const WelcomeScreen = ({
  title,
  description,
  opening,
  isLoading = false,
  pet,
  suggestions,
}: WelcomeScreenProps) => {
  if (opening && !isLoading) {
    return <OpeningMessage opening={opening} pet={pet} suggestions={suggestions} />;
  }

  const resolvedTitle = title ?? "What shall we get into?";
  const resolvedDescription =
    description ??
    "Questions, ideas, or problems: bring what you have and we’ll take it from there.";

  return (
    <div
      className="@container/welcome w-full px-4 pt-4 pb-2 text-center"
      aria-busy={isLoading}
      aria-live="polite"
    >
      <div
        className="mx-auto flex justify-center"
        style={{ minHeight: getPetSpriteHeight(WELCOME_PET_SIZE) }}
      >
        {pet}
      </div>
      <h2 className="flex min-h-16 items-end justify-center font-display text-3xl font-medium tracking-tight text-balance text-foreground @2xl/welcome:min-h-12 @2xl/welcome:text-5xl">
        <span
          key={resolvedTitle}
          aria-hidden={isLoading}
          data-dynamic-copy=""
          className={cn(isLoading ? "opacity-0" : "polychat-motion-enter")}
        >
          {resolvedTitle}
        </span>
      </h2>
      <p className="mt-2 mb-4 flex min-h-12 items-start justify-center text-muted-foreground @2xl/welcome:min-h-6">
        <span
          key={resolvedDescription}
          aria-hidden={isLoading}
          data-dynamic-copy=""
          className={cn(
            isLoading ? "opacity-0" : "polychat-motion-enter polychat-motion-stagger-1",
          )}
        >
          {resolvedDescription}
        </span>
      </p>
      {suggestions}
    </div>
  );
};
