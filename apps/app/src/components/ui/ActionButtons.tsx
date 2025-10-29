import type { ReactNode } from "react";

import { cn } from "~/lib/utils";
import { Button } from "./Button";

interface ActionButton {
  /** Unique identifier for the action */
  id: string;
  /** Icon to display */
  icon: ReactNode;
  /** Accessible label */
  label: string;
  /** Click handler */
  onClick: () => void;
  /** Visual variant */
  variant?: "default" | "success" | "destructive" | "active";
  /** Whether the action is disabled */
  disabled?: boolean;
  /** Whether the action is loading */
  loading?: boolean;
  /** Custom className */
  className?: string;
}

interface ActionButtonsProps {
  /** Array of action button configurations */
  actions: ActionButton[];
  /** Alignment of the action buttons */
  align?: "left" | "right" | "center";
  /** Custom className for the container */
  className?: string;
}

export function ActionButtons({
  actions,
  align = "right",
  className,
}: ActionButtonsProps) {
  const alignmentClasses = {
    left: "justify-start",
    right: "justify-end",
    center: "justify-center",
  };

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2",
        alignmentClasses[align],
        className,
      )}
    >
      <div className="flex items-center space-x-1">
        {actions.map((action) => (
          <Button
            key={action.id}
            type="button"
            variant="icon"
            onClick={action.onClick}
            disabled={action.disabled || action.loading}
            className={cn(
              "cursor-pointer p-1 hover:bg-zinc-200/50 dark:hover:bg-zinc-600/50 rounded-lg transition-colors duration-200 flex items-center text-zinc-500 dark:text-zinc-400",
              action.variant === "success" &&
                "text-green-500 dark:text-green-400 bg-green-100/50 dark:bg-green-900/20",
              action.variant === "destructive" &&
                "text-red-500 dark:text-red-400 hover:bg-red-100/50 dark:hover:bg-red-900/20",
              action.variant === "active" &&
                "bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100",
              (action.disabled || action.loading) &&
                "opacity-50 cursor-not-allowed",
              action.className,
            )}
            title={action.loading ? `${action.label}...` : action.label}
            aria-label={action.loading ? `${action.label}...` : action.label}
          >
            <span className={action.loading ? "animate-spin" : ""}>
              {action.icon}
            </span>
          </Button>
        ))}
      </div>
    </div>
  );
}
