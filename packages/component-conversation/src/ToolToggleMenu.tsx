import { cn } from "@ngriffin_uk/polychat-component-ui";
import type * as React from "react";

interface MenuToggleButtonProps {
  description?: string;
  icon: React.ReactNode;
  isDisabled: boolean;
  isPressed: boolean;
  label: string;
  onToggle: () => void;
}

function MenuToggleButton({
  description,
  icon,
  isDisabled,
  isPressed,
  label,
  onToggle,
}: MenuToggleButtonProps) {
  return (
    <button
      type="button"
      disabled={isDisabled}
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onToggle();
      }}
      aria-label={label}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
        isPressed ? "bg-selection text-foreground" : "text-foreground hover:bg-surface-elevated",
        isDisabled && "cursor-not-allowed opacity-50 hover:bg-transparent",
      )}
      aria-pressed={isPressed}
    >
      <span className="flex min-w-0 items-center gap-3">
        {icon}
        <span className="block min-w-0">
          <span className="block truncate font-medium leading-5">{label}</span>
          {description ? (
            <span className="block truncate text-xs text-muted-foreground">{description}</span>
          ) : null}
        </span>
      </span>
      <span
        className={cn(
          "flex h-6 w-10 shrink-0 rounded-full p-0.5",
          isPressed ? "bg-active-work justify-end" : "bg-border-strong",
        )}
        aria-hidden="true"
      >
        <span className="bg-surface h-5 w-5 rounded-full" />
      </span>
    </button>
  );
}

export interface ToolToggleOption {
  key: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  isPressed: boolean;
  isDisabled?: boolean;
  onToggle: () => void;
}

export interface ToolToggleMenuProps {
  options: ToolToggleOption[];
  isDisabled?: boolean;
  showHeading?: boolean;
}

export function ToolToggleMenu({
  options,
  isDisabled = false,
  showHeading = true,
}: ToolToggleMenuProps) {
  return (
    <div className={showHeading ? "border-t border-border pt-2" : undefined}>
      {showHeading ? (
        <div className="px-3 pb-1 text-[11px] font-semibold uppercase text-muted-foreground">
          Tools
        </div>
      ) : null}
      <div className="space-y-1">
        {options.map((option) => (
          <MenuToggleButton
            key={option.key}
            description={option.description}
            icon={option.icon}
            isDisabled={isDisabled || !!option.isDisabled}
            isPressed={option.isPressed}
            label={option.label}
            onToggle={option.onToggle}
          />
        ))}
      </div>
    </div>
  );
}
