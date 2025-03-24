import { forwardRef } from "react";
import type { LabelHTMLAttributes } from "react";

import { cn } from "~/lib/utils";

export interface FormLabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  className?: string;
  htmlFor?: string;
}

export const FormLabel = forwardRef<HTMLLabelElement, FormLabelProps>(
  ({ className, children, htmlFor, ...props }, ref) => {
    return (
      <label
        ref={ref}
        htmlFor={htmlFor}
        className={cn(
          "block text-sm font-medium text-zinc-700 dark:text-zinc-300",
          className,
        )}
        {...props}
      >
        {children}
      </label>
    );
  },
);

FormLabel.displayName = "FormLabel";
