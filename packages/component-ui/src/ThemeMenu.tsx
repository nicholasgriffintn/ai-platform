import { ChevronRight, Palette } from "lucide-react";

import { OptionsMenu, OptionsMenuRadioGroup } from "./OptionsMenu";
import { getThemePreferenceOptions, type ThemePreference } from "./theme";
import { cn } from "./utils";

const OPTIONS = getThemePreferenceOptions().map((option) => ({
  value: option.value,
  label: option.label,
}));

export interface ThemeMenuProps {
  value: ThemePreference;
  onChange: (preference: ThemePreference) => void;
  triggerClassName?: string;
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
  sideOffset?: number;
}

export function ThemeMenu({
  value,
  onChange,
  triggerClassName,
  align = "start",
  side = "right",
  sideOffset = 12,
}: ThemeMenuProps) {
  const selected = OPTIONS.find((option) => option.value === value);

  return (
    <OptionsMenu
      modal={false}
      align={align}
      side={side}
      sideOffset={sideOffset}
      className="w-44"
      trigger={
        <button
          type="button"
          className={cn(
            "flex w-full items-center justify-between gap-3 text-left",
            triggerClassName,
          )}
        >
          <span className="flex items-center gap-2">
            <Palette className="h-4 w-4" aria-hidden="true" />
            <span>Theme</span>
          </span>
          <span className="text-muted-foreground flex shrink-0 items-center gap-1 text-xs">
            {selected?.label}
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        </button>
      }
    >
      <OptionsMenuRadioGroup value={value} options={OPTIONS} onChange={onChange} />
    </OptionsMenu>
  );
}
