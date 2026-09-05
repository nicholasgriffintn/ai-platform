import { Check } from "lucide-react";
import { useId } from "react";

import {
  getThemeDefinition,
  getThemePreferenceOptions,
  type ThemePreference,
  type ThemePreferenceOption,
} from "./theme";
import { cn } from "./utils";

const OPTIONS = getThemePreferenceOptions();

const ROLE_CHIPS = [
  "bg-active-work",
  "bg-human-action",
  "bg-success",
  "bg-attention",
  "bg-failure",
  "bg-creative",
];

function ThemeComposerPreview({ compact = false }: { compact?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "bg-surface border-border flex flex-col gap-2 rounded-lg border",
        compact ? "p-2.5" : "p-3",
      )}
    >
      <span className="bg-surface-elevated h-1.5 w-3/5 rounded-full" />
      <span className={cn("text-foreground font-medium", compact ? "text-xs" : "text-sm")}>
        What’s on your mind?
      </span>
      {!compact && (
        <span className="text-muted-foreground text-xs leading-snug">
          Bring a question, a rough idea, or something to work through.
        </span>
      )}
      <span className="flex items-center gap-1.5">
        <span className="bg-surface-elevated border-border h-6 flex-1 rounded-md border" />
        <span className="bg-human-action h-6 w-6 rounded-md" />
      </span>
    </span>
  );
}

function ThemeRoleChips() {
  return (
    <span aria-hidden className="flex gap-1.5">
      {ROLE_CHIPS.map((chip) => (
        <span key={chip} className={cn("h-4 w-4 rounded", chip)} />
      ))}
    </span>
  );
}

function ThemeCardHeader({
  label,
  caption,
  isSelected,
}: {
  label: string;
  caption: string;
  isSelected: boolean;
}) {
  return (
    <span className="flex items-baseline justify-between gap-3">
      <span className="text-foreground flex items-center gap-2 text-xl font-semibold">
        {label}
        {isSelected && <Check className="text-active-work h-4 w-4 shrink-0" aria-hidden />}
      </span>
      <span className="text-muted-foreground font-mono text-[11px] tracking-wider uppercase">
        {caption}
      </span>
    </span>
  );
}

function ThemeCardBody({
  option,
  isSelected,
}: {
  option: ThemePreferenceOption;
  isSelected: boolean;
}) {
  if (option.value === "system") {
    return (
      <>
        <ThemeCardHeader label={option.label} caption="Light · Dark" isSelected={isSelected} />
        <span className="text-muted-foreground text-sm leading-snug">{option.description}</span>
        <span className="border-border grid grid-cols-2 overflow-hidden rounded-lg border">
          {option.preview.map((id) => (
            <span key={id} data-polychat-theme={id} className="bg-canvas flex flex-col gap-2 p-2">
              <ThemeComposerPreview compact />
              <ThemeRoleChips />
            </span>
          ))}
        </span>
      </>
    );
  }

  const theme = getThemeDefinition(option.value);

  return (
    <>
      <ThemeCardHeader
        label={option.label}
        caption={`${theme.appearance} · ${theme.themeColor}`}
        isSelected={isSelected}
      />
      <span className="text-muted-foreground min-h-10 text-sm leading-snug">
        {option.description}
      </span>
      <ThemeComposerPreview />
      <ThemeRoleChips />
    </>
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
    <fieldset className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-3", className)}>
      <legend className="sr-only">Theme</legend>
      {OPTIONS.map((option) => {
        const isSelected = option.value === value;
        const themeId = option.value === "system" ? undefined : option.value;

        return (
          <label
            key={option.value}
            data-polychat-theme={themeId}
            className={cn(
              "bg-canvas text-foreground polychat-motion-micro flex cursor-pointer flex-col gap-3 rounded-xl border p-4 transition-[outline-color,border-color,transform]",
              "has-[:focus-visible]:outline-active-work has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2",
              "motion-safe:hover:-translate-y-0.5",
              isSelected
                ? "border-active-work outline-active-work outline-2 outline-offset-2"
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
            <ThemeCardBody option={option} isSelected={isSelected} />
          </label>
        );
      })}
    </fieldset>
  );
}
