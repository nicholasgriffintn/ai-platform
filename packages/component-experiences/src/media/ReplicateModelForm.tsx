import { Button, Checkbox, FormSelect, Input, Textarea } from "@ngriffin_uk/polychat-component-ui";
import type { ReplicateModel, ReplicateInputField } from "@ngriffin_uk/polychat-schemas";
import {
  formatUnknownValue,
  getNumberInputValue,
  parseNumberInputValue,
} from "@ngriffin_uk/polychat-utility-core";
import { useId } from "react";

import { splitInputLines } from "../utils/replicate-form";
import { useReplicateForm } from "./useReplicateForm";

interface ReplicateModelFormProps {
  model: ReplicateModel;
  onSubmit: (data: Record<string, any>) => void;
  isSubmitting: boolean;
}

export function ReplicateModelForm({ model, onSubmit, isSubmitting }: ReplicateModelFormProps) {
  const { formData, errors, handleChange, validate } = useReplicateForm(model);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) {
      return;
    }

    const data = validate();

    if (!data) {
      return;
    }

    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {model.inputSchema.fields.map((field) => (
        <FormField
          key={field.name}
          field={field}
          value={formData[field.name]}
          onChange={(value) => handleChange(field.name, value)}
          error={errors[field.name]}
        />
      ))}

      <div className="pt-4">
        <Button type="submit" variant="primary" size="lg" fullWidth isLoading={isSubmitting}>
          {isSubmitting ? "Generating..." : "Generate"}
        </Button>
      </div>
    </form>
  );
}

interface FormFieldProps {
  field: ReplicateInputField;
  value: any;
  onChange: (value: any) => void;
  error?: string;
}

function FormField({ field, value, onChange, error }: FormFieldProps) {
  const fieldTypes = Array.isArray(field.type) ? field.type : [field.type];
  const isFileField = fieldTypes.includes("file");
  const hasEnum = field.enum && field.enum.length > 0;
  const generatedFieldId = useId();
  const fieldId = `replicate-field-${generatedFieldId}`;
  const descriptionId = field.description ? `${fieldId}-description` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined;
  const fieldValue = value ?? "";
  const numberFieldValue = getNumberInputValue(value);

  return (
    <div>
      <label htmlFor={fieldId} className="mb-2 block text-sm font-medium text-foreground">
        {field.name}
        {field.required && <span className="ml-1 text-failure">*</span>}
        {field.required && <span className="sr-only"> (required)</span>}
      </label>

      {field.description && (
        <p id={descriptionId} className="mb-2 text-sm text-muted-foreground">
          {field.description}
        </p>
      )}

      {hasEnum ? (
        <FormSelect
          id={fieldId}
          value={String(fieldValue)}
          placeholder="Select..."
          aria-describedby={describedBy}
          options={(field.enum ?? []).map((option) => ({
            value: String(option),
            label: String(option),
          }))}
          onValueChange={(option) =>
            onChange(field.enum?.find((entry) => String(entry) === option) ?? option)
          }
        />
      ) : fieldTypes.includes("boolean") ? (
        <Checkbox
          id={fieldId}
          checked={Boolean(value)}
          aria-describedby={describedBy}
          aria-invalid={Boolean(error)}
          onCheckedChange={(checked) => onChange(checked === true)}
        />
      ) : fieldTypes.includes("integer") ? (
        <Input
          id={fieldId}
          type="number"
          step="1"
          value={numberFieldValue}
          onChange={(e) => onChange(parseNumberInputValue(e.target.value, { integer: true }))}
          required={field.required}
          aria-describedby={describedBy}
          aria-invalid={Boolean(error)}
          className="h-auto bg-surface px-4 py-2"
        />
      ) : fieldTypes.includes("number") ? (
        <Input
          id={fieldId}
          type="number"
          step="any"
          value={numberFieldValue}
          onChange={(e) => onChange(parseNumberInputValue(e.target.value))}
          required={field.required}
          aria-describedby={describedBy}
          aria-invalid={Boolean(error)}
          className="h-auto bg-surface px-4 py-2"
        />
      ) : fieldTypes.includes("array") ? (
        <Textarea
          id={fieldId}
          value={Array.isArray(value) ? value.join("\n") : ""}
          onChange={(e) => onChange(splitInputLines(e.target.value))}
          placeholder="One URL per line"
          rows={4}
          required={field.required}
          aria-describedby={describedBy}
          aria-invalid={Boolean(error)}
          className="bg-surface px-4 py-2"
        />
      ) : isFileField ? (
        <div className="space-y-2">
          <Input
            id={fieldId}
            type="url"
            placeholder="Enter file URL..."
            value={fieldValue}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
            aria-describedby={describedBy}
            aria-invalid={Boolean(error)}
            className="h-auto bg-surface px-4 py-2"
          />
          <p className="text-xs text-muted-foreground">
            Provide a publicly accessible URL to the file
          </p>
        </div>
      ) : field.name.toLowerCase().includes("prompt") ||
        field.description?.toLowerCase().includes("description") ? (
        <Textarea
          id={fieldId}
          value={fieldValue}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          required={field.required}
          aria-describedby={describedBy}
          aria-invalid={Boolean(error)}
          className="bg-surface px-4 py-2"
        />
      ) : (
        <Input
          id={fieldId}
          type="text"
          value={fieldValue}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          aria-describedby={describedBy}
          aria-invalid={Boolean(error)}
          className="h-auto bg-surface px-4 py-2"
        />
      )}

      {error && (
        <p id={errorId} className="mt-1 text-sm text-failure">
          {error}
        </p>
      )}

      {field.default !== undefined && (value === undefined || value === null || value === "") && (
        <p className="mt-1 text-xs text-muted-foreground">
          Default: {formatUnknownValue(field.default)}
        </p>
      )}
    </div>
  );
}
