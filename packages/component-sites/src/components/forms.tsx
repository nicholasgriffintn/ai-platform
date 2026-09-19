import { cn } from "@ngriffin_uk/polychat-component-ui";
import type { SiteComponentProps } from "@ngriffin_uk/polychat-library-sites";
import { useState } from "react";

import { SiteIcon } from "../icons.js";
import { Action, Field, FieldLabel, HEADING_FONT, SelectField, TextField } from "../ui.js";

export function Form({
  title,
  description,
  fields,
  submitLabel,
  layout = "stacked",
  onSubmit,
}: SiteComponentProps<"Form"> & { onSubmit?: (values: Record<string, unknown>) => void }) {
  return (
    <form
      className="flex w-full max-w-xl flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();

        if (!onSubmit) {
          return;
        }

        const form = event.currentTarget;
        const values = Object.fromEntries(
          fields.map((field) => {
            const control = form.elements.namedItem(field.name) as {
              value?: string;
              checked?: boolean;
            } | null;

            return [
              field.name,
              field.type === "checkbox" ? Boolean(control?.checked) : (control?.value ?? ""),
            ];
          }),
        );

        onSubmit(values);
        form.reset();
      }}
    >
      {(title || description) && (
        <div className="flex flex-col gap-1">
          {title && (
            <h2 className={cn("text-2xl font-semibold tracking-tight", HEADING_FONT)}>{title}</h2>
          )}
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      )}
      <div className={cn("grid gap-4", layout === "inline" && "sm:grid-cols-2")}>
        {fields.map((field) => {
          const id = `site-field-${field.name}`;

          if (field.type === "checkbox") {
            return (
              <label key={field.name} htmlFor={id} className="flex items-center gap-2 text-sm">
                <input
                  id={id}
                  name={field.name}
                  type="checkbox"
                  required={field.required}
                  className="size-4 rounded border-input accent-primary"
                />
                {field.label}
              </label>
            );
          }

          return (
            <div
              key={field.name}
              className={cn("flex flex-col gap-2", field.type === "textarea" && "sm:col-span-2")}
            >
              <FieldLabel htmlFor={id}>
                {field.label}
                {field.required && <span className="text-destructive"> *</span>}
              </FieldLabel>
              {field.type === "textarea" ? (
                <TextField
                  id={id}
                  name={field.name}
                  placeholder={field.placeholder}
                  required={field.required}
                />
              ) : field.type === "select" ? (
                <SelectField id={id} name={field.name} required={field.required} defaultValue="">
                  <option value="" disabled>
                    {field.placeholder ?? "Select"}
                  </option>
                  {field.options?.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </SelectField>
              ) : (
                <Field
                  id={id}
                  name={field.name}
                  type={field.type}
                  placeholder={field.placeholder}
                  required={field.required}
                />
              )}
            </div>
          );
        })}
      </div>
      <Action className="w-fit" type="submit">
        {submitLabel}
      </Action>
    </form>
  );
}

export function Input({
  label,
  placeholder,
  type = "text",
  icon,
  value,
  onChange,
}: SiteComponentProps<"Input"> & { value?: string; onChange?: (value: string) => void }) {
  return (
    <div className="flex w-full max-w-sm flex-col gap-2">
      {label && <FieldLabel>{label}</FieldLabel>}
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">
            <SiteIcon name={icon} size="sm" />
          </span>
        )}
        <Field
          type={type}
          placeholder={placeholder}
          aria-label={label ?? placeholder}
          className={cn(icon && "pl-9")}
          {...(onChange
            ? { value: value ?? "", onChange: (event) => onChange(event.target.value) }
            : { defaultValue: value })}
        />
      </div>
    </div>
  );
}

export function Select({
  label,
  options,
  value,
  onChange,
}: SiteComponentProps<"Select"> & { onChange?: (value: string) => void }) {
  return (
    <div className="flex w-full max-w-xs flex-col gap-2">
      {label && <FieldLabel>{label}</FieldLabel>}
      <SelectField
        aria-label={label}
        {...(onChange
          ? { value: value ?? options[0], onChange: (event) => onChange(event.target.value) }
          : { defaultValue: value ?? options[0] })}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </SelectField>
    </div>
  );
}

export function Switch({
  label,
  description,
  checked = false,
  onChange,
}: SiteComponentProps<"Switch"> & { onChange?: (checked: boolean) => void }) {
  const [internal, setInternal] = useState(checked);
  const on = onChange ? checked : internal;
  const setOn = (next: boolean) => {
    setInternal(next);
    onChange?.(next);
  };

  return (
    <label className="flex items-start justify-between gap-4 text-sm">
      <span className="flex flex-col gap-0.5">
        <span className="font-medium">{label}</span>
        {description && <span className="text-muted-foreground">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => setOn(!on)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
          on ? "bg-primary" : "bg-muted",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-5 rounded-full bg-background shadow transition-transform",
            on ? "translate-x-5" : "translate-x-0.5",
          )}
        />
      </button>
    </label>
  );
}
