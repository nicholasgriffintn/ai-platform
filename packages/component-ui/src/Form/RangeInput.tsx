import { clampPercentage } from "@ngriffin_uk/polychat-utility-core";
import type { InputHTMLAttributes } from "react";
import { forwardRef, useId } from "react";

import { Label } from "../label";
import { cn } from "../utils";
import { mergeDescribedBy } from "./describedBy";

export interface RangeInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  description?: string;
  min?: number;
  max?: number;
  step?: number;
  displayValue?: boolean;
  markers?: string[];
  className?: string;
}

export const RangeInput = forwardRef<HTMLInputElement, RangeInputProps>(
  (
    {
      label,
      description,
      min = 0,
      max = 1,
      step = 0.1,
      displayValue = true,
      markers,
      className,
      id,
      value,
      "aria-describedby": ariaDescribedBy,
      ...props
    },
    ref,
  ) => {
    const generatedId = useId();
    const controlId = id ?? generatedId;
    const rawPercentage = ((Number(value) - min) / (max - min)) * 100;
    const percentage = clampPercentage(rawPercentage);
    const descriptionId = description ? `${controlId}-description` : undefined;
    const describedBy = mergeDescribedBy(ariaDescribedBy, descriptionId);

    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          {label && <Label htmlFor={controlId}>{label}</Label>}
          {displayValue && <span className="text-sm font-medium text-foreground">{value}</span>}
        </div>
        <div className="relative mt-2">
          <input
            ref={ref}
            id={controlId}
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            className={cn(
              "w-full appearance-none bg-transparent [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-border-strong [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-surface [&::-webkit-slider-thumb]:shadow-md",
              className,
            )}
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={Number(value)}
            aria-valuetext={label ? `${label}: ${String(value)}` : String(value)}
            aria-describedby={describedBy}
            {...props}
          />
          <div
            className="pointer-events-none absolute top-1/2 left-0 h-[2px] -translate-y-1/2 bg-active-work"
            style={{
              width: `${percentage}%`,
            }}
            aria-hidden="true"
          />
        </div>
        {markers && (
          <div className="mt-1 flex justify-between text-xs text-muted-foreground">
            {markers.map((marker) => (
              <span key={`marker-${marker}`}>{marker}</span>
            ))}
          </div>
        )}
        {description && (
          <p id={descriptionId} className="mt-1 text-xs text-muted-foreground">
            {description}
          </p>
        )}
      </div>
    );
  },
);

RangeInput.displayName = "RangeInput";
