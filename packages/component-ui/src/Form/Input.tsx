import type { InputHTMLAttributes } from "react";
import { forwardRef, useId } from "react";

import { Label } from "../label";
import { cn } from "../utils";
import { mergeDescribedBy } from "./describedBy";

export interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  description?: string;
  className?: string;
  fullWidth?: boolean;
  disabled?: boolean;
}

export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  (
    {
      label,
      description,
      className,
      fullWidth = true,
      id,
      disabled = false,
      "aria-describedby": ariaDescribedBy,
      ...props
    },
    ref,
  ) => {
    const generatedId = useId();
    const controlId = id ?? generatedId;
    const descriptionId = description ? `${controlId}-description` : undefined;
    const describedBy = mergeDescribedBy(ariaDescribedBy, descriptionId);

    return (
      <div className={cn("space-y-1", fullWidth && "w-full")}>
        {label && <Label htmlFor={controlId}>{label}</Label>}
        <input
          ref={ref}
          id={controlId}
          className={cn(
            "border-input bg-surface text-foreground focus:border-ring focus:ring-ring/30 rounded-md border px-3 py-1.5 text-sm focus:ring-[3px] focus:outline-none",
            fullWidth && "w-full",
            className,
            disabled && "opacity-50 cursor-not-allowed",
          )}
          aria-describedby={describedBy}
          disabled={disabled}
          {...props}
        />
        {description && (
          <p id={descriptionId} className="text-muted-foreground mt-1 text-xs">
            {description}
          </p>
        )}
      </div>
    );
  },
);

FormInput.displayName = "FormInput";
