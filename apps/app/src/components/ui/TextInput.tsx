import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";

import { cn } from "~/lib/utils";
import { FormLabel } from "./FormLabel";

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  description?: string;
  className?: string;
  fullWidth?: boolean;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  ({ label, description, className, fullWidth = true, id, ...props }, ref) => {
    return (
      <div className={cn("space-y-1", fullWidth && "w-full")}>
        {label && <FormLabel htmlFor={id}>{label}</FormLabel>}
        <input
          ref={ref}
          id={id}
          className={cn(
            "px-3 py-1.5 text-sm rounded-md border border-zinc-200 dark:border-zinc-700 bg-off-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100",
            fullWidth && "w-full",
            className,
          )}
          {...props}
        />
        {description && (
          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
            {description}
          </p>
        )}
      </div>
    );
  },
);

TextInput.displayName = "TextInput";
