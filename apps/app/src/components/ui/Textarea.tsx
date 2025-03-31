import { forwardRef } from "react";
import type { TextareaHTMLAttributes } from "react";

import { cn } from "~/lib/utils";
import { FormLabel } from "./FormLabel";

export interface TextAreaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  description?: string;
  className?: string;
  fullWidth?: boolean;
  disabled?: boolean;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  (
    {
      label,
      description,
      className,
      fullWidth = true,
      id,
      disabled = false,
      ...props
    },
    ref,
  ) => {
    return (
      <div className={cn("space-y-1", fullWidth && "w-full")}>
        {label && <FormLabel htmlFor={id}>{label}</FormLabel>}
        <textarea
          ref={ref}
          id={id}
          className={cn(
            "px-3 py-1.5 text-sm rounded-md border border-zinc-200 dark:border-zinc-700 bg-off-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100",
            fullWidth && "w-full",
            className,
            disabled && "opacity-50 cursor-not-allowed",
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

TextArea.displayName = "TextArea";
