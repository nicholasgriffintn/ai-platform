import type { TextareaHTMLAttributes } from "react";
import { forwardRef, useId } from "react";

import { Label } from "../label";
import { Textarea } from "../Textarea";
import { cn } from "../utils";
import { mergeDescribedBy } from "./describedBy";

export interface FormTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  description?: string;
  className?: string;
}

export const FormTextarea = forwardRef<HTMLTextAreaElement, FormTextareaProps>(
  ({ label, description, className, id, "aria-describedby": ariaDescribedBy, ...props }, ref) => {
    const generatedId = useId();
    const controlId = id ?? generatedId;
    const descriptionId = description ? `${controlId}-description` : undefined;

    return (
      <div className="w-full min-w-0 space-y-1">
        {label && <Label htmlFor={controlId}>{label}</Label>}
        <Textarea
          ref={ref}
          id={controlId}
          className={cn("min-h-20 resize-y", className)}
          aria-describedby={mergeDescribedBy(ariaDescribedBy, descriptionId)}
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

FormTextarea.displayName = "FormTextarea";
