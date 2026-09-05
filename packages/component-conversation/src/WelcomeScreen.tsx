import { cn } from "@ngriffin_uk/polychat-component-ui";
import type { ReactNode } from "react";

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
      <div className="mx-auto flex h-32 w-32 items-end justify-center">{pet}</div>
      <h2 className="text-foreground flex min-h-16 items-end justify-center text-2xl font-semibold md:min-h-12 md:text-4xl">
        <span
          key={resolvedTitle}
          aria-hidden={isLoading}
          data-dynamic-copy=""
          className={cn(isLoading ? "opacity-0" : "polychat-motion-enter")}
        >
          {resolvedTitle}
        </span>
      </h2>
      <p className="text-muted-foreground mt-2 mb-4 flex min-h-12 items-start justify-center md:min-h-6">
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
