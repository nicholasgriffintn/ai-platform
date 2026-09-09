import type { InputHTMLAttributes } from "react";
import { forwardRef, useId } from "react";

import { Input } from "../input";
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
        <Input
          ref={ref}
          id={controlId}
          className={cn("bg-surface text-sm", fullWidth ? "w-full" : "w-auto", className)}
          aria-describedby={describedBy}
          disabled={disabled}
          {...props}
        />
        {description && (
          <p id={descriptionId} className="mt-1 text-xs text-muted-foreground">
            {description}
          </p>
        )}
      </div>
    );
  },
);

FormInput.displayName = "FormInput";
