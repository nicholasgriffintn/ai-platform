import { useId } from "react";

import { cn } from "../utils";

export interface FormRadioOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface FormRadioGroupProps<T extends string> {
  legend: string;
  description?: string;
  name?: string;
  value: T;
  options: readonly FormRadioOption<T>[];
  disabled?: boolean;
  className?: string;
  optionClassName?: string;
  onValueChange: (value: T) => void;
}

export function FormRadioGroup<T extends string>({
  legend,
  description,
  name,
  value,
  options,
  disabled = false,
  className,
  optionClassName,
  onValueChange,
}: FormRadioGroupProps<T>) {
  const generatedName = useId();
  const groupName = name ?? generatedName;

  return (
    <fieldset className={cn("space-y-2", className)}>
      <legend className="text-sm font-medium">{legend}</legend>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      <div className="space-y-2">
        {options.map((option) => {
          const isDisabled = disabled || option.disabled;

          return (
            <label
              key={option.value}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 text-sm",
                isDisabled && "cursor-not-allowed opacity-60",
                optionClassName,
              )}
            >
              <input
                type="radio"
                name={groupName}
                className="mt-1 accent-active-work"
                value={option.value}
                disabled={isDisabled}
                checked={option.value === value}
                onChange={() => onValueChange(option.value)}
              />
              <span>
                <span className="font-medium">{option.label}</span>
                {option.description && (
                  <span className="block text-xs text-muted-foreground">{option.description}</span>
                )}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
