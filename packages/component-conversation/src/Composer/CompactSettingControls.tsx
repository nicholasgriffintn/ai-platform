import { Checkbox, FormSelect, Input, RangeInput, cn } from "@ngriffin_uk/polychat-component-ui";

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
  return (
    <FormSelect
      id={id}
      label={label}
      description={description}
      disabled={disabled}
      value={value}
      options={options}
      onValueChange={onChange}
    />
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
        <Input
          id={id}
          type="number"
          min={min}
          max={max}
          value={value}
          placeholder={placeholder?.toString()}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby={descriptionId}
          className="h-8 w-28 bg-surface px-2 text-right text-sm"
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

  return (
    <RangeInput
      id={id}
      label={label}
      description={description}
      disabled={disabled}
      min={min}
      max={max}
      step={step}
      markers={markers}
      value={resolvedValue}
      valueLabel={isAutomatic ? automaticLabel : value}
      fillClassName={isAutomatic ? "opacity-40" : undefined}
      action={
        onReset && !isAutomatic ? (
          <button
            type="button"
            onClick={onReset}
            disabled={disabled}
            className="text-[11px] font-medium text-active-work underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
          >
            Reset
          </button>
        ) : undefined
      }
      onChange={(event) => onChange(event.target.value)}
    />
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
        <Checkbox
          id={id}
          checked={checked}
          disabled={disabled}
          aria-describedby={descriptionId}
          onCheckedChange={(state) => onChange(state === true)}
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
