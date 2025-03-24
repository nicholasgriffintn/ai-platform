import type { ChangeEvent } from "react";

import { Checkbox, Select, TextInput } from "~/components/ui";
import type { AppSchema } from "~/lib/api/dynamic-apps";

type FieldType = AppSchema["formSchema"]["steps"][0]["fields"][0];

interface FormFieldProps {
  field: FieldType;
  value: any;
  onChange: (id: string, value: any) => void;
  error?: string;
}

export const FormField = ({
  field,
  value,
  onChange,
  error,
}: FormFieldProps) => {
  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    let newValue: any = e.target.value;

    if (field.type === "number") {
      newValue = e.target.value === "" ? "" : Number(e.target.value);
    } else if (field.type === "checkbox") {
      newValue = (e.target as HTMLInputElement).checked;
    }

    onChange(field.id, newValue);
  };

  const handleMultiSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const options = e.target.options;
    const selectedValues: string[] = [];

    for (let i = 0; i < options.length; i++) {
      if (options[i].selected) {
        selectedValues.push(options[i].value);
      }
    }

    onChange(field.id, selectedValues);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onChange(field.id, files[0]);
    }
  };

  const renderField = () => {
    switch (field.type) {
      case "text":
        return (
          <TextInput
            id={field.id}
            value={value || ""}
            onChange={handleChange}
            placeholder={field.placeholder}
            required={field.required}
            description={error}
            aria-describedby={error ? `${field.id}-error` : undefined}
            aria-invalid={!!error}
          />
        );

      case "textarea":
        return (
          <textarea
            id={field.id}
            value={value || ""}
            onChange={handleChange}
            placeholder={field.placeholder}
            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 bg-off-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 min-h-[100px]"
            required={field.required}
            aria-describedby={error ? `${field.id}-error` : undefined}
            aria-invalid={!!error}
          />
        );

      case "number":
        return (
          <TextInput
            id={field.id}
            type="number"
            value={value === undefined ? "" : value}
            onChange={handleChange}
            placeholder={field.placeholder}
            min={field.validation?.min}
            max={field.validation?.max}
            required={field.required}
            description={error}
            aria-describedby={error ? `${field.id}-error` : undefined}
            aria-invalid={!!error}
          />
        );

      case "select":
        return (
          <Select
            id={field.id}
            value={value || ""}
            onChange={handleChange}
            required={field.required}
            description={error}
            aria-describedby={error ? `${field.id}-error` : undefined}
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
            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 bg-off-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 min-h-[100px]"
            required={field.required}
            aria-describedby={error ? `${field.id}-error` : undefined}
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
          <Checkbox
            id={field.id}
            checked={value || false}
            onChange={handleChange}
            required={field.required}
            label={field.label}
            description={error}
            labelPosition="right"
            aria-describedby={error ? `${field.id}-error` : undefined}
            aria-invalid={!!error}
          />
        );

      case "date":
        return (
          <TextInput
            id={field.id}
            type="date"
            value={value || ""}
            onChange={handleChange}
            required={field.required}
            description={error}
            aria-describedby={error ? `${field.id}-error` : undefined}
            aria-invalid={!!error}
          />
        );

      case "file":
        return (
          <input
            type="file"
            id={field.id}
            onChange={handleFileChange}
            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 bg-off-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            required={field.required}
            aria-describedby={error ? `${field.id}-error` : undefined}
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
        <label
          htmlFor={field.id}
          className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-1"
        >
          {field.label}{" "}
          {field.required && (
            <span className="text-red-500 dark:text-red-400" aria-hidden="true">
              *
            </span>
          )}
          {field.required && <span className="sr-only"> (required)</span>}
        </label>
      )}

      {field.description && (
        <p
          className="text-sm text-zinc-500 dark:text-zinc-400 mb-1"
          id={`${field.id}-description`}
        >
          {field.description}
        </p>
      )}

      {renderField()}
    </div>
  );
};
