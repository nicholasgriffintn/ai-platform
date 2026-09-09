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

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        {label && labelPosition === "left" && <Label htmlFor={controlId}>{label}</Label>}
        {control}
        {label && labelPosition === "right" && <Label htmlFor={controlId}>{label}</Label>}
      </div>
      {description && (
        <p id={descriptionId} className="mt-1 text-xs text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  );
}
