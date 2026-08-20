import { cn } from "@ngriffin_uk/polychat-component-ui";
import type { ReactNode } from "react";

export interface WelcomeScreenProps {
  title?: string;
  description?: string;
  isLoading?: boolean;
  /** The product mark, supplied by the host so branding stays a host decision. */
  logo: ReactNode;
  /** Prompt suggestions, supplied by the host that owns their selection and tracking. */
  suggestions: ReactNode;
}

export const WelcomeScreen = ({
  title,
  description,
  isLoading = false,
  logo,
  suggestions,
}: WelcomeScreenProps) => {
  const resolvedTitle = title ?? "What shall we get into?";
  const resolvedDescription =
    description ??
    "Questions, ideas, or problems: bring what you have and we’ll take it from there.";

  return (
    <div className="w-full px-4 pt-4 pb-2 text-center" aria-busy={isLoading} aria-live="polite">
      <div className="w-32 h-32 mx-auto hover:animate-flutter motion-reduce:animate-none">
        {logo}
      </div>
      <h2 className="flex min-h-16 items-end justify-center text-2xl font-semibold text-zinc-800 md:min-h-12 md:text-4xl dark:text-zinc-200">
        <span
          key={resolvedTitle}
          aria-hidden={isLoading}
          data-dynamic-copy=""
          className={cn(
            isLoading
              ? "opacity-0"
              : "animate-in fade-in-0 slide-in-from-bottom-2 duration-500 motion-reduce:animate-none motion-reduce:transform-none",
          )}
        >
          {resolvedTitle}
        </span>
      </h2>
      <p className="mt-2 mb-4 flex min-h-12 items-start justify-center text-zinc-600 md:min-h-6 dark:text-zinc-400">
        <span
          key={resolvedDescription}
          aria-hidden={isLoading}
          data-dynamic-copy=""
          className={cn(
            isLoading
              ? "opacity-0"
              : "animate-in fade-in-0 slide-in-from-bottom-1 delay-100 duration-500 motion-reduce:animate-none motion-reduce:transform-none",
          )}
        >
          {resolvedDescription}
        </span>
      </p>
      {suggestions}
    </div>
  );
};
