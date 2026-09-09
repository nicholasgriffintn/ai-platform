import { Button, Checkbox, FormSelect, Input, Textarea } from "@ngriffin_uk/polychat-component-ui";
import type { ReplicateModel, ReplicateInputField } from "@ngriffin_uk/polychat-schemas";
import { getNumberInputValue, parseNumberInputValue } from "@ngriffin_uk/polychat-utility-core";
import { useEffect, useId, useState } from "react";

interface ReplicateModelFormProps {
  model: ReplicateModel;
  onSubmit: (data: Record<string, any>) => void;
  isSubmitting: boolean;
}

export function ReplicateModelForm({ model, onSubmit, isSubmitting }: ReplicateModelFormProps) {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const initialData: Record<string, any> = {};

    model.inputSchema.fields.forEach((field) => {
      if (field.default !== undefined) {
        initialData[field.name] = field.default;
      }
    });
    setFormData(initialData);
  }, [model]);

  const handleChange = (fieldName: string, value: any) => {
    setFormData((prev) => ({ ...prev, [fieldName]: value }));
    setErrors((prev) => {
      const newErrors = { ...prev };

      delete newErrors[fieldName];

      return newErrors;
    });
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    model.inputSchema.fields.forEach((field) => {
      if (field.required && isReplicateRequiredValueMissing(formData[field.name])) {
        newErrors[field.name] = `${field.name} is required`;
      }
    });

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    onSubmit(formData);
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

function isReplicateRequiredValueMissing(value: unknown): boolean {
  if (value === undefined || value === null) {
    return true;
  }

  if (typeof value === "string") {
    return value.trim().length === 0;
  }

  if (typeof value === "number") {
    return !Number.isFinite(value);
  }

  return !value;
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
          value={fieldValue}
          placeholder="Select..."
          aria-describedby={describedBy}
          options={(field.enum ?? []).map((option) => ({
            value: String(option),
            label: String(option),
          }))}
          onValueChange={onChange}
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
        <p className="mt-1 text-xs text-muted-foreground">Default: {String(field.default)}</p>
      )}
    </div>
  );
}
