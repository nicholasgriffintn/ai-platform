import { Check, ChevronsUpDown } from "lucide-react";
import { useId } from "react";

import { Button } from "../Button";
import { DropdownMenu, DropdownMenuItem } from "../DropdownMenu";
import { Label } from "../label";
import { OptionsMenu, OptionsMenuAction } from "../OptionsMenu";
import { cn } from "../utils";
import { mergeDescribedBy } from "./describedBy";

export interface FormSelectOption<T extends string = string> {
  value: T;
  label: string;
  disabled?: boolean;
}

export interface FormSelectProps<T extends string = string> {
  label?: string;
  description?: string;
  options: readonly FormSelectOption<T>[];
  value: T | "" | undefined;
  onValueChange: (value: T) => void;
  placeholder?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  className?: string;
  triggerClassName?: string;
  menuClassName?: string;
  portal?: boolean;
  id?: string;
  name?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
}

export function FormSelect<T extends string = string>({
  label,
  description,
  options,
  value,
  onValueChange,
  placeholder = "Select an option",
  disabled = false,
  fullWidth = true,
  className,
  triggerClassName,
  menuClassName,
  portal = false,
  id,
  name,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
}: FormSelectProps<T>) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const descriptionId = description ? `${controlId}-description` : undefined;
  const describedBy = mergeDescribedBy(ariaDescribedBy, descriptionId);
  const selected = options.find((option) => option.value === value);
  const trigger = (
    <>
      <span className={cn("truncate", !selected && "text-muted-foreground")}>
        {selected?.label ?? placeholder}
      </span>
      <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-60" aria-hidden="true" />
    </>
  );
  const triggerProps = {
    id: controlId,
    name,
    type: "button" as const,
    variant: "outline" as const,
    fullWidth,
    disabled,
    "aria-label": label ? undefined : ariaLabel,
    "aria-describedby": describedBy,
    className: cn("justify-between font-normal", triggerClassName),
  };

  const menuItems = options.map((option) => (
    <OptionsMenuAction
      key={option.value}
      disabled={option.disabled}
      className="justify-between text-sm"
      onSelect={() => onValueChange(option.value)}
    >
      <span className="truncate">{option.label}</span>
      {option.value === value && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
    </OptionsMenuAction>
  ));

  return (
    <div className={cn("space-y-1", fullWidth && "w-full", className)}>
      {label && (
        <Label htmlFor={controlId} className="text-sm font-medium">
          {label}
        </Label>
      )}
      {portal ? (
        <OptionsMenu
          trigger={<Button {...triggerProps}>{trigger}</Button>}
          align="start"
          side="bottom"
          sideOffset={8}
          className={cn(
            fullWidth && "w-[var(--radix-dropdown-menu-trigger-width)]",
            "max-h-64 overflow-y-auto text-sm",
            menuClassName,
          )}
        >
          {menuItems}
        </OptionsMenu>
      ) : (
        <DropdownMenu
          className={cn(fullWidth && "w-full")}
          menuClassName={cn(fullWidth && "w-full", "max-h-64 overflow-y-auto", menuClassName)}
          buttonProps={triggerProps}
          trigger={trigger}
        >
          {options.map((option) => (
            <DropdownMenuItem
              key={option.value}
              disabled={option.disabled}
              className="justify-between"
              onClick={() => onValueChange(option.value)}
            >
              <span className="truncate">{option.label}</span>
              {option.value === value && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenu>
      )}
      {description && (
        <p id={descriptionId} className="mt-1 text-xs text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  );
}
