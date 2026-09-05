import { FormCheckbox, FormInput, FormSelect, Textarea } from "@ngriffin_uk/polychat-component-ui";
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

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    let newValue: any = e.target.value;

    if (field.type === "number") {
      newValue = parseNumberInputValue(e.target.value);
    } else if (field.type === "checkbox") {
      newValue = (e.target as HTMLInputElement).checked;
    }

    onChange(field.id, newValue);
  };

  const handleMultiSelectChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const options = e.target.options;
    const selectedValues: string[] = [];

    for (let i = 0; i < options.length; i++) {
      if (options[i].selected) {
        selectedValues.push(options[i].value);
      }
    }

    onChange(field.id, selectedValues);
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
            className="text-base w-full px-3 py-2 border border-border-strong bg-surface-elevated text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-active-work min-h-[100px]"
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
            onChange={handleChange}
            required={field.required}
            aria-describedby={describedBy}
            aria-invalid={!!error}
            options={[
              { value: "", label: "Select an option" },
              ...(field.validation?.options?.map((option) => ({
                value: option.value,
                label: option.label,
              })) || []),
            ]}
          />
        );

      case "multiselect":
        return (
          <select
            id={field.id}
            multiple
            value={value || []}
            onChange={handleMultiSelectChange}
            className="w-full px-3 py-2 border border-border-strong bg-surface-elevated text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-active-work min-h-[100px]"
            required={field.required}
            aria-describedby={describedBy}
            aria-invalid={!!error}
          >
            {field.validation?.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );

      case "checkbox":
        return (
          <FormCheckbox
            id={field.id}
            checked={value || false}
            onChange={handleChange}
            required={field.required}
            label={field.label}
            labelPosition="right"
            aria-describedby={describedBy}
            aria-invalid={!!error}
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
          <input
            type="file"
            id={field.id}
            onChange={handleFileChange}
            className="w-full px-3 py-2 border border-border-strong bg-surface-elevated text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-active-work"
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
        <label htmlFor={field.id} className="block text-sm font-medium text-foreground mb-1">
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
        <p className="text-sm text-muted-foreground mb-1" id={`${field.id}-description`}>
          {field.description}
        </p>
      )}

      {renderField()}

      {error && (
        <p id={errorId} className="text-sm text-failure mt-1">
          {error}
        </p>
      )}
    </div>
  );
};
