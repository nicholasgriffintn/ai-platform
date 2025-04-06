import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";

import { cn } from "~/lib/utils";
import { FormLabel } from "./FormLabel";

export interface SwitchProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  label?: string;
  description?: string;
  className?: string;
  labelPosition?: "left" | "right";
  checked?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  (
    {
      label,
      description,
      className,
      labelPosition = "left",
      id,
      checked,
      onChange,
      ...props
    },
    ref,
  ) => {
    const handleToggle = () => {
      if (onChange) {
        const event = {
          target: {
            name: props.name,
            checked: !checked,
          },
        } as React.ChangeEvent<HTMLInputElement>;
        onChange(event);
      }
    };

    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          {label && labelPosition === "left" && (
            <FormLabel htmlFor={id}>{label}</FormLabel>
          )}
          <button
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={handleToggle}
            className={cn(
              "relative inline-block w-10 h-6 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 rounded-full",
              className,
            )}
            id={id}
          >
            <input
              ref={ref}
              id={`${id}-hidden`}
              type="checkbox"
              className="sr-only"
              checked={checked}
              onChange={onChange}
              {...props}
            />
            <span
              className={cn(
                "absolute inset-0 rounded-full transition-colors",
                checked
                  ? "bg-zinc-600 dark:bg-zinc-400"
                  : "bg-zinc-300 dark:bg-zinc-700",
              )}
            />
            <span
              className={cn(
                "absolute left-1 top-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 ease-in-out",
                checked ? "translate-x-4" : "translate-x-0",
              )}
            />
          </button>
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

Switch.displayName = "Switch";
