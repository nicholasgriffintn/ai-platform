import {
  cn,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ShortcutTooltip,
} from "@ngriffin_uk/polychat-component-ui";
import { ChevronDown, ChevronUp } from "lucide-react";
import { type ReactNode, useState } from "react";

export interface InlineSettingSelectProps<T extends string> {
  id: string;
  label: string;
  icon: ReactNode;
  value: T | "";
  displayLabel: string;
  options: Array<{ value: T | ""; label: string }>;
  isDisabled?: boolean;
  shortcut?: string;
  onChange: (value: T | "") => void;
}

export function InlineSettingSelect<T extends string>({
  id,
  label,
  icon,
  value,
  displayLabel,
  options,
  isDisabled = false,
  shortcut,
  onChange,
}: InlineSettingSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <ShortcutTooltip keys={shortcut ? [shortcut] : []} label={`Select ${label.toLowerCase()}`}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={isDisabled}
            aria-label={`${label}: ${displayLabel}`}
            aria-haspopup="menu"
            aria-expanded={isOpen}
            className={cn(
              "polychat-motion-micro inline-flex h-8 min-w-8 items-center gap-1.5 rounded-md px-2 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-60",
              isOpen
                ? "bg-selection text-foreground"
                : "text-muted-foreground hover:bg-selection hover:text-foreground",
            )}
          >
            <span
              className="flex h-4 w-4 flex-shrink-0 items-center justify-center"
              aria-hidden="true"
            >
              {icon}
            </span>
            <span
              className="hidden max-w-[130px] truncate @2xl/composer-footer:inline"
              title={displayLabel}
            >
              {displayLabel}
            </span>
            {isOpen ? (
              <ChevronUp className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
            )}
          </button>
        </PopoverTrigger>
      </ShortcutTooltip>
      <PopoverContent
        side="top"
        align="start"
        className="w-56 border-border bg-popover p-1 text-popover-foreground shadow-[var(--polychat-elevated-shadow)]"
        aria-label={label}
      >
        <div
          id={id}
          className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase"
        >
          {label}
        </div>
        <div role="menu" aria-labelledby={id}>
          {options.map((option) => {
            const isSelected = option.value === value;

            return (
              <button
                key={`${id}-${option.value || "default"}`}
                type="button"
                role="menuitemradio"
                aria-checked={isSelected}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm text-popover-foreground hover:bg-selection",
                  isSelected && "bg-selection font-medium",
                )}
              >
                <span>{option.label}</span>
                {isSelected && <span className="text-xs text-muted-foreground">Selected</span>}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
