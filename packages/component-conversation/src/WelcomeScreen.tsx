import { cn } from "@ngriffin_uk/polychat-component-ui";
import { getPetSpriteHeight } from "@ngriffin_uk/polychat-schemas";
import type { ReactNode } from "react";

export const WELCOME_PET_SIZE = 128;

export interface WelcomeScreenProps {
  title?: string;
  description?: string;
  isLoading?: boolean;
  pet: ReactNode;
  suggestions: ReactNode;
}

export const WelcomeScreen = ({
  title,
  description,
  isLoading = false,
  pet,
  suggestions,
}: WelcomeScreenProps) => {
  const resolvedTitle = title ?? "What shall we get into?";
  const resolvedDescription =
    description ??
    "Questions, ideas, or problems: bring what you have and we’ll take it from there.";

  return (
    <div className="w-full px-4 pt-4 pb-2 text-center" aria-busy={isLoading} aria-live="polite">
      <div
        className="mx-auto flex justify-center"
        style={{ minHeight: getPetSpriteHeight(WELCOME_PET_SIZE) }}
      >
        {pet}
      </div>
      <h2 className="flex min-h-16 items-end justify-center font-display text-3xl font-medium tracking-tight text-balance text-foreground md:min-h-12 md:text-5xl">
        <span
          key={resolvedTitle}
          aria-hidden={isLoading}
          data-dynamic-copy=""
          className={cn(isLoading ? "opacity-0" : "polychat-motion-enter")}
        >
          {resolvedTitle}
        </span>
      </h2>
      <p className="mt-2 mb-4 flex min-h-12 items-start justify-center text-muted-foreground md:min-h-6">
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
