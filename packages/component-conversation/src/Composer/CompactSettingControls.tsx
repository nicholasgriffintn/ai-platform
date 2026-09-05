import { cn } from "@ngriffin_uk/polychat-component-ui";
import { clampPercentage } from "@ngriffin_uk/polychat-utility-core";
import type { ChangeEvent } from "react";

interface CompactSelectOption {
  label: string;
  value: string;
}

interface CompactSettingSelectProps {
  description?: string;
  disabled?: boolean;
  id: string;
  label: string;
  onChange: (value: string) => void;
  options: CompactSelectOption[];
  value: string;
}

export function CompactSettingSelect({
  description,
  disabled,
  id,
  label,
  onChange,
  options,
  value,
}: CompactSettingSelectProps) {
  const descriptionId = description ? `${id}-description` : undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-medium text-foreground">
        {label}
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        aria-describedby={descriptionId}
        className="border-border bg-surface text-foreground focus:border-active-work h-9 w-full rounded-md border px-2.5 text-sm outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-60"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {description && (
        <p id={descriptionId} className="text-xs text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  );
}

interface CompactSettingNumberProps {
  description?: string;
  disabled?: boolean;
  id: string;
  label: string;
  max?: number;
  min?: number;
  onChange: (value: string) => void;
  placeholder?: number | string;
  value: number | string;
}

export function CompactSettingNumber({
  description,
  disabled,
  id,
  label,
  max,
  min,
  onChange,
  placeholder,
  value,
}: CompactSettingNumberProps) {
  const descriptionId = description ? `${id}-description` : undefined;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-xs font-medium text-foreground">
          {label}
        </label>
        <input
          id={id}
          type="number"
          min={min}
          max={max}
          value={value}
          placeholder={placeholder?.toString()}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby={descriptionId}
          className="border-border bg-surface text-foreground focus:border-active-work h-8 w-28 rounded-md border px-2 text-right text-sm outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>
      {description && (
        <p id={descriptionId} className="text-xs text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  );
}

interface CompactSettingRangeProps {
  automaticLabel?: string;
  automaticValue?: number;
  disabled?: boolean;
  description?: string;
  id: string;
  label: string;
  markers?: string[];
  max: number;
  min: number;
  onChange: (value: string) => void;
  onReset?: () => void;
  step: number;
  value?: number;
}

export function CompactSettingRange({
  automaticLabel = "Automatic",
  automaticValue,
  description,
  disabled,
  id,
  label,
  markers,
  max,
  min,
  onChange,
  onReset,
  step,
  value,
}: CompactSettingRangeProps) {
  const isAutomatic = value === undefined;
  const resolvedValue = value ?? automaticValue ?? min;
  const rawPercentage = ((resolvedValue - min) / (max - min)) * 100;
  const percentage = clampPercentage(rawPercentage);
  const descriptionId = description ? `${id}-description` : undefined;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-xs font-medium text-foreground">
          {label}
        </label>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            {isAutomatic ? automaticLabel : value}
          </span>
          {onReset && !isAutomatic && (
            <button
              type="button"
              onClick={onReset}
              disabled={disabled}
              className="text-[11px] font-medium text-active-work underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
            >
              Reset
            </button>
          )}
        </div>
      </div>
      <div className="relative">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={resolvedValue}
          disabled={disabled}
          onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
          aria-describedby={descriptionId}
          className="h-4 w-full appearance-none bg-transparent disabled:cursor-not-allowed disabled:opacity-60 [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-zinc-200 dark:[&::-webkit-slider-runnable-track]:bg-zinc-700 [&::-webkit-slider-thumb]:mt-[-5px] [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow"
        />
        <div
          className={cn(
            "pointer-events-none absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-active-work",
            isAutomatic && "opacity-40",
          )}
          style={{ width: `${percentage}%` }}
          aria-hidden="true"
        />
      </div>
      {markers && (
        <div className="flex justify-between text-[11px] text-muted-foreground">
          {markers.map((marker) => (
            <span key={marker}>{marker}</span>
          ))}
        </div>
      )}
      {description && (
        <p id={descriptionId} className="text-xs text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  );
}

interface CompactSettingSwitchProps {
  checked: boolean;
  description?: string;
  disabled?: boolean;
  id: string;
  label: string;
  onChange: (checked: boolean) => void;
}

export function CompactSettingSwitch({
  checked,
  description,
  disabled,
  id,
  label,
  onChange,
}: CompactSettingSwitchProps) {
  const descriptionId = description ? `${id}-description` : undefined;

  return (
    <div className="space-y-1">
      <label
        htmlFor={id}
        className={cn(
          "flex cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-2 text-sm transition-colors",
          disabled && "cursor-not-allowed opacity-60",
          checked ? "bg-selection text-foreground" : "text-foreground hover:bg-surface-elevated",
        )}
      >
        <span className="font-medium">{label}</span>
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          aria-describedby={descriptionId}
          className="h-4 w-4 rounded border-border-strong text-foreground focus:ring-border-strong"
        />
      </label>
      {description && (
        <p id={descriptionId} className="px-2 text-xs text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  );
}
