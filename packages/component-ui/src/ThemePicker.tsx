import { Check } from "lucide-react";
import { useId } from "react";

import { FormSelect } from "./Form/Select";
import {
  DEFAULT_THEME_PAIR,
  getThemeDefinition,
  getThemePreferenceOptions,
  getThemesByAppearance,
  isThemeId,
  type ThemeAppearance,
  type ThemeId,
  type ThemePair,
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
      <span className="text-foreground font-display flex items-center gap-2 text-2xl font-medium tracking-tight">
        {label}
        {isSelected && <Check className="text-active-work h-4 w-4 shrink-0" aria-hidden />}
      </span>
      <span className="polychat-eyebrow">{caption}</span>
    </span>
  );
}

function ThemeCardBody({
  option,
  isSelected,
  pair,
}: {
  option: ThemePreferenceOption;
  isSelected: boolean;
  pair: ThemePair;
}) {
  if (option.value === "system") {
    const day = getThemeDefinition(pair.light);
    const night = getThemeDefinition(pair.dark);

    return (
      <>
        <ThemeCardHeader
          label={option.label}
          caption={`${day.label} · ${night.label}`}
          isSelected={isSelected}
        />
        <span className="text-muted-foreground text-sm leading-snug">{option.description}</span>
        <span className="border-border grid grid-cols-2 overflow-hidden rounded-lg border">
          {[pair.light, pair.dark].map((id) => (
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

function PairSelect({
  appearance,
  label,
  value,
  onChange,
}: {
  appearance: ThemeAppearance;
  label: string;
  value: ThemeId;
  onChange: (id: ThemeId) => void;
}) {
  return (
    <FormSelect
      label={label}
      value={value}
      className="py-1 text-xs"
      options={getThemesByAppearance(appearance).map((theme) => ({
        value: theme.id,
        label: theme.label,
      }))}
      onChange={(event) => {
        const next = event.target.value;

        if (isThemeId(next)) {
          onChange(next);
        }
      }}
    />
  );
}

export interface ThemePickerProps {
  value: ThemePreference;
  onChange: (preference: ThemePreference) => void;
  pair?: ThemePair;
  onPairChange?: (pair: ThemePair) => void;
  className?: string;
}

export function ThemePicker({
  value,
  onChange,
  pair = DEFAULT_THEME_PAIR,
  onPairChange,
  className,
}: ThemePickerProps) {
  const name = useId();

  return (
    <fieldset className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-3", className)}>
      <legend className="sr-only">Theme</legend>
      {OPTIONS.map((option) => {
        const isSelected = option.value === value;
        const themeId = option.value === "system" ? undefined : option.value;
        const inputId = `${name}-${option.value}`;

        return (
          <div
            key={option.value}
            data-polychat-theme={themeId}
            className={cn(
              "bg-canvas text-foreground polychat-motion-micro flex flex-col gap-3 rounded-xl border p-4 transition-[outline-color,border-color,transform]",
              "has-[:focus-visible]:outline-active-work has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2",
              "motion-safe:hover:-translate-y-0.5",
              isSelected
                ? "border-active-work outline-active-work outline-2 outline-offset-2"
                : "border-border hover:border-border-strong",
            )}
          >
            <input
              type="radio"
              id={inputId}
              name={name}
              value={option.value}
              checked={isSelected}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            <label htmlFor={inputId} className="flex cursor-pointer flex-col gap-3">
              <ThemeCardBody option={option} isSelected={isSelected} pair={pair} />
            </label>
            {option.value === "system" && onPairChange && (
              <span className="grid grid-cols-2 gap-2">
                <PairSelect
                  appearance="light"
                  label="By day"
                  value={pair.light}
                  onChange={(light) => onPairChange({ ...pair, light })}
                />
                <PairSelect
                  appearance="dark"
                  label="By night"
                  value={pair.dark}
                  onChange={(dark) => onPairChange({ ...pair, dark })}
                />
              </span>
            )}
          </div>
        );
      })}
    </fieldset>
  );
}
