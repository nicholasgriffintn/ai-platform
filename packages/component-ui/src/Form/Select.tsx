import type { ReactNode, SelectHTMLAttributes } from "react";
import { forwardRef, useId } from "react";

import { Label } from "../label";
import { cn } from "../utils";
import { mergeDescribedBy } from "./describedBy";

export interface FormSelectOption {
  value: string;
  label: string;
}

export interface FormSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  description?: string;
  className?: string;
  options?: FormSelectOption[];
  children?: ReactNode;
  fullWidth?: boolean;
}

export const FormSelect = forwardRef<HTMLSelectElement, FormSelectProps>(
  (
    {
      label,
      description,
      options,
      children,
      className,
      fullWidth = true,
      id,
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
        <select
          ref={ref}
          id={controlId}
          className={cn(
            "border-input bg-surface text-foreground focus:border-ring focus:ring-ring/30 w-full rounded-md border px-3 py-1.5 text-sm focus:ring-[3px] focus:outline-none",
            fullWidth && "w-full",
            className,
          )}
          aria-describedby={describedBy}
          {...props}
        >
          {options
            ? options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))
            : children}
        </select>
        {description && (
          <p id={descriptionId} className="text-muted-foreground mt-1 text-xs">
            {description}
          </p>
        )}
      </div>
    );
  },
);

FormSelect.displayName = "FormSelect";
