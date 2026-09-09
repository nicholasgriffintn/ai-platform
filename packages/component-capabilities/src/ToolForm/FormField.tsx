import {
  Checkbox,
  FormCheckbox,
  FormInput,
  FormSelect,
  Input,
  Label,
  Textarea,
} from "@ngriffin_uk/polychat-component-ui";
import type { RenderableTool } from "@ngriffin_uk/polychat-schemas";
import { getNumberInputValue, parseNumberInputValue } from "@ngriffin_uk/polychat-utility-core";
import type { ChangeEvent } from "react";

type FieldType = RenderableTool["formSchema"]["steps"][0]["fields"][0];

interface FormFieldProps {
  field: FieldType;
  value: any;
  onChange: (id: string, value: any) => void;
  error?: string;
}

export const FormField = ({ field, value, onChange, error }: FormFieldProps) => {
  const descriptionId = field.description ? `${field.id}-description` : undefined;
  const errorId = error ? `${field.id}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined;

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange(
      field.id,
      field.type === "number" ? parseNumberInputValue(e.target.value) : e.target.value,
    );
  };

  const toggleMultiSelectValue = (optionValue: string, selected: boolean) => {
    const current: string[] = Array.isArray(value) ? value : [];

    onChange(
      field.id,
      selected ? [...current, optionValue] : current.filter((entry) => entry !== optionValue),
    );
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;

    if (files && files.length > 0) {
      onChange(field.id, files[0]);
    }
  };

  const renderField = () => {
    switch (field.type) {
      case "text":
        return (
          <FormInput
            id={field.id}
            value={value || ""}
            onChange={handleChange}
            placeholder={field.placeholder}
            required={field.required}
            aria-describedby={describedBy}
            aria-invalid={!!error}
          />
        );

      case "textarea":
        return (
          <Textarea
            id={field.id}
            value={value || ""}
            onChange={handleChange}
            placeholder={field.placeholder}
            className="min-h-[100px] w-full rounded-md border border-border-strong bg-surface-elevated px-3 py-2 text-base text-foreground focus:ring-2 focus:ring-active-work focus:outline-none"
            required={field.required}
            aria-describedby={describedBy}
            aria-invalid={!!error}
          />
        );

      case "number":
        return (
          <FormInput
            id={field.id}
            type="number"
            value={getNumberInputValue(value)}
            onChange={handleChange}
            placeholder={field.placeholder}
            min={field.validation?.min}
            max={field.validation?.max}
            required={field.required}
            aria-describedby={describedBy}
            aria-invalid={!!error}
          />
        );

      case "select":
        return (
          <FormSelect
            id={field.id}
            value={value || ""}
            aria-describedby={describedBy}
            options={
              field.validation?.options?.map((option) => ({
                value: option.value,
                label: option.label,
              })) ?? []
            }
            onValueChange={(selected) => onChange(field.id, selected)}
          />
        );

      case "multiselect":
        return (
          <div
            id={field.id}
            role="group"
            aria-describedby={describedBy}
            className="max-h-52 space-y-2 overflow-y-auto rounded-md border border-border-strong bg-surface-elevated p-3"
          >
            {field.validation?.options?.map((option) => (
              <Label
                key={option.value}
                htmlFor={`${field.id}-${option.value}`}
                className="cursor-pointer font-normal"
              >
                <Checkbox
                  id={`${field.id}-${option.value}`}
                  checked={Array.isArray(value) && value.includes(option.value)}
                  onCheckedChange={(checked) =>
                    toggleMultiSelectValue(option.value, checked === true)
                  }
                />
                {option.label}
              </Label>
            ))}
          </div>
        );

      case "checkbox":
        return (
          <FormCheckbox
            id={field.id}
            checked={value === true}
            label={field.label}
            labelPosition="right"
            aria-describedby={describedBy}
            onCheckedChange={(checked) => onChange(field.id, checked)}
          />
        );

      case "date":
        return (
          <FormInput
            id={field.id}
            type="date"
            value={value || ""}
            onChange={handleChange}
            required={field.required}
            aria-describedby={describedBy}
            aria-invalid={!!error}
          />
        );

      case "file":
        return (
          <Input
            type="file"
            id={field.id}
            onChange={handleFileChange}
            className="h-auto bg-surface-elevated py-2"
            required={field.required}
            aria-describedby={describedBy}
            aria-invalid={!!error}
          />
        );

      default:
        return <div>Unsupported field type: {field.type}</div>;
    }
  };

  return (
    <div className="mb-4">
      {field.type !== "checkbox" && (
        <label htmlFor={field.id} className="mb-1 block text-sm font-medium text-foreground">
          {field.label}{" "}
          {field.required && (
            <span className="text-failure" aria-hidden="true">
              *
            </span>
          )}
          {field.required && <span className="sr-only"> (required)</span>}
        </label>
      )}

      {field.description && (
        <p className="mb-1 text-sm text-muted-foreground" id={`${field.id}-description`}>
          {field.description}
        </p>
      )}

      {renderField()}

      {error && (
        <p id={errorId} className="mt-1 text-sm text-failure">
          {error}
        </p>
      )}
    </div>
  );
};
