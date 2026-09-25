import type { ReactNode } from "react";

import { Button } from "./Button";
import { cn } from "./utils";

interface ActionButton {
  id: string;
  icon: ReactNode;
  label: string;
  onClick: () => void;
  variant?: "default" | "success" | "destructive" | "active";
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

interface ActionButtonsProps {
  actions: ActionButton[];
  align?: "left" | "right" | "center";
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
              action.variant === "success" && "bg-success/12 text-success",
              action.variant === "destructive" &&
                "text-failure hover:bg-failure/12 hover:text-failure",
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
