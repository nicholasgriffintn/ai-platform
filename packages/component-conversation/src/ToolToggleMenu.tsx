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
      onClick={onToggle}
      aria-label={label}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
        isPressed
          ? "bg-zinc-100 text-zinc-950 dark:bg-zinc-800 dark:text-zinc-50"
          : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800",
        isDisabled && "cursor-not-allowed opacity-50 hover:bg-transparent",
      )}
      aria-pressed={isPressed}
    >
      <span className="flex min-w-0 items-center gap-3">
        {icon}
        <span className="block min-w-0">
          <span className="block truncate font-medium leading-5">{label}</span>
          {description ? (
            <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">
              {description}
            </span>
          ) : null}
        </span>
      </span>
      <span
        className={cn(
          "flex h-6 w-10 shrink-0 rounded-full p-0.5",
          isPressed ? "justify-end bg-blue-500" : "bg-zinc-200 dark:bg-zinc-700",
        )}
        aria-hidden="true"
      >
        <span className="h-5 w-5 rounded-full bg-white dark:bg-zinc-300" />
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
    <div className={showHeading ? "border-t border-zinc-200 pt-2 dark:border-zinc-700" : undefined}>
      {showHeading ? (
        <div className="px-3 pb-1 text-[11px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">
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
