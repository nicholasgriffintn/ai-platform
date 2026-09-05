import { Check, Monitor } from "lucide-react";
import { useId } from "react";

import { THEMES, type ThemeId, type ThemePreference } from "./theme";
import { cn } from "./utils";

interface ThemePickerOption {
  value: ThemePreference;
  label: string;
  description: string;
  preview: ThemeId[];
}

const OPTIONS: ThemePickerOption[] = [
  {
    value: "system",
    label: "System",
    description: "Follow the device between light and dark.",
    preview: ["light", "dark"],
  },
  ...THEMES.map((theme) => ({
    value: theme.id as ThemePreference,
    label: theme.label,
    description: theme.description,
    preview: [theme.id],
  })),
];

function ThemePreviewPane({ id }: { id: ThemeId }) {
  return (
    <span
      data-polychat-theme={id}
      className="bg-canvas flex h-full flex-1 flex-col justify-between gap-1 p-1.5"
    >
      <span className="bg-surface-elevated h-1.5 w-2/3 rounded-full" />
      <span className="flex items-center gap-1">
        <span className="bg-surface h-3 flex-1 rounded-sm" />
        <span className="bg-active-work h-3 w-2 rounded-sm" />
        <span className="bg-human-action h-3 w-2 rounded-sm" />
      </span>
    </span>
  );
}

export interface ThemePickerProps {
  value: ThemePreference;
  onChange: (preference: ThemePreference) => void;
  className?: string;
}

export function ThemePicker({ value, onChange, className }: ThemePickerProps) {
  const name = useId();

  return (
    <fieldset className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-4", className)}>
      <legend className="sr-only">Theme</legend>
      {OPTIONS.map((option) => {
        const isSelected = option.value === value;

        return (
          <label
            key={option.value}
            className={cn(
              "polychat-motion-micro flex cursor-pointer flex-col gap-3 rounded-xl border p-3 transition-colors",
              "has-[:focus-visible]:outline-ring has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2",
              isSelected
                ? "border-active-work bg-selection"
                : "border-border hover:border-border-strong",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={isSelected}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            <span className="border-border flex h-16 overflow-hidden rounded-lg border">
              {option.preview.map((id) => (
                <ThemePreviewPane key={id} id={id} />
              ))}
            </span>
            <span className="flex items-start gap-2">
              <span className="min-w-0 flex-1">
                <span className="text-foreground flex items-center gap-1.5 text-sm font-medium">
                  {option.value === "system" && <Monitor className="h-3.5 w-3.5" aria-hidden />}
                  {option.label}
                </span>
                <span className="text-muted-foreground mt-0.5 block text-xs">
                  {option.description}
                </span>
              </span>
              {isSelected && <Check className="text-active-work mt-0.5 h-4 w-4 shrink-0" />}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
