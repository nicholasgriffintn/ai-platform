import { useId } from "react";

import { Checkbox } from "../Checkbox";
import { Label } from "../label";
import { cn } from "../utils";
import { mergeDescribedBy } from "./describedBy";

export interface FormCheckboxProps {
  label?: string;
  description?: string;
  className?: string;
  labelPosition?: "left" | "right";
  id?: string;
  name?: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
  "aria-describedby"?: string;
}

export function FormCheckbox({
  label,
  description,
  className,
  labelPosition = "left",
  id,
  name,
  checked,
  disabled,
  onCheckedChange,
  "aria-describedby": ariaDescribedBy,
}: FormCheckboxProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const descriptionId = description ? `${controlId}-description` : undefined;
  const describedBy = mergeDescribedBy(ariaDescribedBy, descriptionId);

  const control = (
    <Checkbox
      id={controlId}
      name={name}
      checked={checked}
      disabled={disabled}
      aria-describedby={describedBy}
      className={cn(className)}
      onCheckedChange={(state) => onCheckedChange(state === true)}
    />
  );

  const descriptionText = description && (
    <p id={descriptionId} className="text-xs text-muted-foreground">
      {description}
    </p>
  );

  if (labelPosition === "right") {
    return (
      <div className="flex items-start gap-3">
        <div className="flex h-5 items-center">{control}</div>
        {(label || description) && (
          <div className="min-w-0 space-y-1">
            {label && (
              <Label htmlFor={controlId} className="min-h-5 cursor-pointer leading-5">
                {label}
              </Label>
            )}
            {descriptionText}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex min-h-5 items-center justify-between gap-3">
        {label && (
          <Label htmlFor={controlId} className="cursor-pointer leading-5">
            {label}
          </Label>
        )}
        {control}
      </div>
      {descriptionText}
    </div>
  );
}
