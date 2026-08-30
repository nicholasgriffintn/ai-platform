import type { ReactNode } from "react";

import { Button } from "./Button";
import { cn } from "./utils";

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

export function ActionButtons({ actions, align = "right", className }: ActionButtonsProps) {
  const alignmentClasses = {
    left: "justify-start",
    right: "justify-end",
    center: "justify-center",
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-2", alignmentClasses[align], className)}>
      <div className="flex items-center space-x-1">
        {actions.map((action) => (
          <Button
            key={action.id}
            type="button"
            variant={action.variant === "active" ? "iconActive" : "icon"}
            size="sm"
            onClick={action.onClick}
            disabled={action.disabled || action.loading}
            className={cn(
              action.variant === "success" &&
                "bg-green-100/50 text-green-500 dark:bg-green-900/20 dark:text-green-400",
              action.variant === "destructive" &&
                "text-red-500 hover:bg-red-100/50 hover:text-red-600 dark:text-red-400 dark:hover:bg-red-900/20 dark:hover:text-red-300",
              action.className,
            )}
            title={action.loading ? `${action.label}...` : action.label}
            aria-label={action.loading ? `${action.label}...` : action.label}
          >
            <span className={action.loading ? "animate-spin" : ""}>{action.icon}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}
