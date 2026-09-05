import { Popover, PopoverContent, PopoverTrigger } from "@ngriffin_uk/polychat-component-ui";
import { Info } from "lucide-react";

import type { CanvasInputField } from "./types";
import { formatCanvasFieldLabel } from "./utils";

interface CanvasModelOptionControlsProps {
  fields: CanvasInputField[];
  values: Record<string, string | boolean>;
  onChange: (fieldName: string, value: string | boolean) => void;
}

function getFieldTypes(field: CanvasInputField): string[] {
  return Array.isArray(field.type) ? field.type : [field.type];
}

function getFieldHelpText(field: CanvasInputField): string {
  if (field.description) {
    return field.description;
  }

  switch (field.name) {
    case "aspect_ratio":
      return "Controls the output frame shape. Pick a ratio supported by the selected model.";
    case "resolution":
      return "Controls the output resolution. Pick a value supported by the selected model.";
    case "size":
      return "Enter an output size such as 1024x1024, or use the model default.";
    case "output_compression":
      return "Enter a JPEG or WebP compression value from 0 to 100.";
    case "n":
      return "Enter the number of images to request from the model.";
    default:
      break;
  }

  if (field.enum?.length) {
    return "Choose one of the values supported by the selected model.";
  }

  const fieldTypes = getFieldTypes(field);

  if (fieldTypes.includes("integer")) {
    return "Enter a whole number supported by the selected model.";
  }

  if (fieldTypes.includes("number")) {
    return "Enter a number supported by the selected model.";
  }

  if (fieldTypes.includes("boolean")) {
    return "Toggle this option for models that support it.";
  }

  return "Enter a value supported by the selected model, or leave it on the default.";
}

function getFieldPlaceholder(field: CanvasInputField): string {
  const fieldTypes = getFieldTypes(field);

  if (fieldTypes.includes("array")) {
    return "One URL per line";
  }

  switch (field.name) {
    case "size":
      return "e.g. 1024x1024";
    case "output_compression":
      return "0-100";
    case "n":
      return "1";
    default:
      return "Default";
  }
}

function FieldHelp({ field }: { field: CanvasInputField }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Help for ${formatCanvasFieldLabel(field.name)}`}
          className="text-muted-foreground hover:bg-selection hover:text-foreground focus:ring-ring inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition focus:ring-2 focus:outline-none"
        >
          <Info className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-64 text-sm leading-5">
        {getFieldHelpText(field)}
      </PopoverContent>
    </Popover>
  );
}

function FieldLabel({ field, label }: { field: CanvasInputField; label: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <label
        htmlFor={`canvas-option-${field.name}`}
        className="text-foreground text-sm font-medium leading-5"
      >
        {label}
      </label>
      <FieldHelp field={field} />
    </div>
  );
}

export function CanvasModelOptionControls({
  fields,
  values,
  onChange,
}: CanvasModelOptionControlsProps) {
  if (fields.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <label className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
        Options
      </label>
      <div className="border-border bg-surface overflow-hidden rounded-xl border">
        {fields.map((field) => {
          const fieldTypes = getFieldTypes(field);
          const label = formatCanvasFieldLabel(field.name);
          const value = values[field.name];

          if (field.enum?.length) {
            return (
              <div
                key={field.name}
                className="border-border space-y-1.5 border-b px-3 py-2.5 last:border-b-0"
              >
                <FieldLabel field={field} label={label} />
                <select
                  id={`canvas-option-${field.name}`}
                  value={typeof value === "string" ? value : ""}
                  onChange={(event) => onChange(field.name, event.target.value)}
                  className="border-border bg-surface-elevated text-foreground focus:border-active-work h-9 w-full rounded-lg border px-2.5 text-sm outline-none transition"
                >
                  <option value="">Default</option>
                  {field.enum
                    .filter((option): option is string | number =>
                      ["string", "number"].includes(typeof option),
                    )
                    .map((option) => (
                      <option key={String(option)} value={String(option)}>
                        {String(option)}
                      </option>
                    ))}
                </select>
              </div>
            );
          }

          if (fieldTypes.includes("boolean")) {
            return (
              <div
                key={field.name}
                className="border-border flex items-center justify-between gap-3 border-b px-3 py-2.5 last:border-b-0"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <label
                    htmlFor={`canvas-option-${field.name}`}
                    className="text-foreground text-sm font-medium leading-5"
                  >
                    {label}
                  </label>
                  <FieldHelp field={field} />
                </div>
                <input
                  id={`canvas-option-${field.name}`}
                  type="checkbox"
                  checked={value === true}
                  onChange={(event) => onChange(field.name, event.target.checked)}
                  className="border-border bg-surface-elevated text-active-work focus:ring-ring h-5 w-5 shrink-0 rounded"
                />
              </div>
            );
          }

          if (fieldTypes.includes("array")) {
            return (
              <div
                key={field.name}
                className="border-border space-y-1.5 border-b px-3 py-2.5 last:border-b-0"
              >
                <FieldLabel field={field} label={label} />
                <textarea
                  id={`canvas-option-${field.name}`}
                  value={typeof value === "string" ? value : ""}
                  onChange={(event) => onChange(field.name, event.target.value)}
                  rows={3}
                  className="border-border bg-surface-elevated text-foreground focus:border-active-work w-full rounded-lg border px-2.5 py-2 text-sm outline-none transition"
                  placeholder={getFieldPlaceholder(field)}
                />
              </div>
            );
          }

          return (
            <div
              key={field.name}
              className="border-border space-y-1.5 border-b px-3 py-2.5 last:border-b-0"
            >
              <FieldLabel field={field} label={label} />
              <input
                id={`canvas-option-${field.name}`}
                type={
                  fieldTypes.includes("integer") || fieldTypes.includes("number")
                    ? "number"
                    : "text"
                }
                value={typeof value === "string" ? value : ""}
                onChange={(event) => onChange(field.name, event.target.value)}
                className="border-border bg-surface-elevated text-foreground focus:border-active-work h-9 w-full rounded-lg border px-2.5 text-sm outline-none transition"
                placeholder={getFieldPlaceholder(field)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
