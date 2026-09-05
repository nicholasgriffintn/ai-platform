import type { ChangeEvent, InputHTMLAttributes } from "react";
import { forwardRef } from "react";

import { Label } from "../label";
import { cn } from "../utils";
import { mergeDescribedBy } from "./describedBy";

export interface SwitchProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "onChange"
> {
  label?: string;
  description?: string;
  className?: string;
  labelPosition?: "left" | "right";
  checked?: boolean;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  (
    {
      label,
      description,
      className,
      labelPosition = "left",
      id,
      checked,
      onChange,
      "aria-describedby": ariaDescribedBy,
      ...props
    },
    ref,
  ) => {
    const descriptionId = description && id ? `${id}-description` : undefined;
    const describedBy = mergeDescribedBy(ariaDescribedBy, descriptionId);

    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          {label && labelPosition === "left" && <Label htmlFor={id}>{label}</Label>}
          <label className={cn("relative inline-flex h-6 w-10 shrink-0", className)}>
            <input
              ref={ref}
              id={id}
              type="checkbox"
              role="switch"
              className="peer sr-only"
              aria-checked={checked}
              checked={checked}
              onChange={onChange}
              aria-describedby={describedBy}
              {...props}
            />
            <span
              className={cn(
                "peer-focus-visible:ring-ring absolute inset-0 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2 peer-focus-visible:outline-none peer-disabled:cursor-not-allowed peer-disabled:opacity-60",
                checked ? "bg-active-work" : "bg-border-strong",
              )}
              aria-hidden="true"
            />
            <span
              className={cn(
                "bg-surface absolute top-1 left-1 h-4 w-4 rounded-full transition-transform duration-200 ease-in-out",
                checked ? "translate-x-4" : "translate-x-0",
              )}
              aria-hidden="true"
            />
          </label>
          {label && labelPosition === "right" && <Label htmlFor={id}>{label}</Label>}
        </div>
        {description && (
          <p id={descriptionId} className="text-muted-foreground mt-1 text-xs">
            {description}
          </p>
        )}
      </div>
    );
  },
);

Switch.displayName = "Switch";
