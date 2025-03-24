import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";

import { cn } from "~/lib/utils";
import { FormLabel } from "./FormLabel";

export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  description?: string;
  className?: string;
  labelPosition?: "left" | "right";
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  (
    { label, description, className, labelPosition = "left", id, ...props },
    ref,
  ) => {
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          {label && labelPosition === "left" && (
            <FormLabel htmlFor={id}>{label}</FormLabel>
          )}
          <input
            ref={ref}
            id={id}
            type="checkbox"
            className={cn(
              "h-4 w-4 rounded border-zinc-300 text-zinc-600 focus:ring-zinc-500",
              className,
            )}
            {...props}
          />
          {label && labelPosition === "right" && (
            <FormLabel htmlFor={id}>{label}</FormLabel>
          )}
        </div>
        {description && (
          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
            {description}
          </p>
        )}
      </div>
    );
  },
);

Checkbox.displayName = "Checkbox";
