import type { ReactNode } from "react";

import { Button } from "./Button";
import { cn } from "./utils";

const hoverActionButtonClassName =
  "text-muted-foreground hover:bg-selection hover:text-foreground min-h-0 min-w-0 rounded-lg border-0 p-2 font-normal";

interface HoverAction {
  id: string;
  icon: ReactNode;
  label: string;
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
  className?: string;
}

interface HoverActionsProps {
  actions: HoverAction[];
  alwaysVisible?: boolean;
  position?: "right" | "left";
  className?: string;
}

export function HoverActions({
  actions,
  alwaysVisible = false,
  position = "right",
  className,
}: HoverActionsProps) {
  const positionClasses = {
    right: "right-2",
    left: "left-2",
  };

  return (
    <div
      data-hover-actions=""
      className={cn(
        "absolute",
        positionClasses[position],
        alwaysVisible
          ? "opacity-100"
          : "opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100",
        "flex items-center space-x-1 bg-inherit transition-opacity duration-200",
        className,
      )}
    >
      {actions.map((action) => (
        <Button
          key={action.id}
          type="button"
          variant="icon"
          onClick={action.onClick}
          disabled={action.disabled}
          title={action.label}
          aria-label={action.label}
          icon={action.icon}
          size="icon"
          className={cn(hoverActionButtonClassName, action.className)}
        />
      ))}
    </div>
  );
}
