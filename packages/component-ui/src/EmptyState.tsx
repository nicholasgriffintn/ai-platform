import { LogIn } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "./Button";
import { cn } from "./utils";

interface SuggestionItem {
  label: string;
  onClick: () => void;
}

interface EmptyStateProps {
  /** Display variant - 'empty' for standard empty states, 'inset' when rendered inside a card that already provides a border, 'welcome' for welcoming first-time users */
  variant?: "empty" | "inset" | "welcome";
  /** Icon to display (larger in welcome variant) */
  icon?: ReactNode;
  /** Title text or element */
  title?: ReactNode;
  /** Description message */
  message?: string;
  /** Primary action button or element */
  action?: ReactNode;
  /** Suggested actions (displayed as clickable chips) */
  suggestions?: SuggestionItem[];
  /** Custom className */
  className?: string;
}

export const EmptyState = ({
  variant = "empty",
  icon,
  title,
  message,
  action,
  suggestions,
  className,
}: EmptyStateProps) => {
  const isWelcome = variant === "welcome";

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        variant === "empty" && "rounded-xl border border-border bg-surface",
        isWelcome ? "px-4 pt-4 pb-2" : "p-8",
        className,
      )}
    >
      {icon && (
        <div
          className={cn(
            "mx-auto mb-4 flex items-center justify-center rounded-full",
            isWelcome ? "h-32 w-32" : "h-12 w-12 bg-selection",
          )}
        >
          {icon}
        </div>
      )}
      {title && (
        <h3
          className={cn(
            "mb-2 font-display font-medium tracking-tight text-balance text-foreground",
            isWelcome ? "text-3xl md:text-5xl" : "text-2xl",
          )}
        >
          {title}
        </h3>
      )}
      {message && (
        <p
          className={cn(
            "mx-auto max-w-sm text-muted-foreground",
            isWelcome ? "mt-2 mb-4" : "mb-4 text-sm",
          )}
        >
          {message}
        </p>
      )}
      {suggestions && suggestions.length > 0 && (
        <div className="mt-4 mb-4 flex flex-wrap justify-center gap-2">
          {suggestions.map((suggestion, index) => (
            <Button key={index} variant="outline" onClick={suggestion.onClick}>
              {suggestion.label}
            </Button>
          ))}
        </div>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
};

interface SignInEmptyStateProps {
  title?: ReactNode;
  message?: string;
  className?: string;
  onSignIn: () => void;
}

export function SignInEmptyState({
  title = "Sign in to continue",
  message = "Sign in to access this area of Polychat.",
  className,
  onSignIn,
}: SignInEmptyStateProps) {
  return (
    <EmptyState
      icon={<LogIn className="text-active-work" size={24} aria-hidden="true" />}
      title={title}
      message={message}
      action={
        <Button type="button" variant="primary" onClick={onSignIn}>
          Sign in
        </Button>
      }
      className={className}
    />
  );
}
