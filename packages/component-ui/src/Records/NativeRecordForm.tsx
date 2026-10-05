import type { NativeRecordDefinition, NativeRecordValues } from "@ngriffin_uk/polychat-schemas";

import { Button } from "../Button";
import { Input } from "../input";
import { useRecordForm } from "./useRecordForm";

export function NativeRecordForm({
  definition,
  initialValues = {},
  isSaving,
  errorMessage,
  onSave,
  onCancel,
  submitLabel = "Save record",
  cancelLabel = "Cancel",
}: {
  definition: NativeRecordDefinition;
  initialValues?: NativeRecordValues;
  isSaving: boolean;
  errorMessage?: string;
  onSave: (values: NativeRecordValues) => Promise<boolean>;
  onCancel: () => void;
  submitLabel?: string;
  cancelLabel?: string;
}) {
  const form = useRecordForm(definition, initialValues);

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        const values = form.parse();

        if (values) {
          await onSave(values);
        }
      }}
    >
      {definition.columns.map((column) => (
        <label key={column.id} className="block space-y-1 text-sm">
          <span>
            {column.name}
            {column.required ? " *" : ""}
          </span>
          {column.type === "boolean" ? (
            <input
              aria-label={column.name}
              type="checkbox"
              className="ml-2"
              checked={form.values[column.id] === true}
              onChange={(event) => form.setValue(column.id, event.currentTarget.checked)}
            />
          ) : column.type === "select" ? (
            <select
              className="h-9 w-full rounded-md border border-input bg-surface px-2"
              value={String(form.values[column.id] ?? "")}
              required={column.required}
              onChange={(event) => form.setValue(column.id, event.currentTarget.value)}
            >
              <option value="">Choose…</option>
              {column.options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : (
            <Input
              type={column.type === "date" ? "date" : column.type === "number" ? "number" : "text"}
              step={column.type === "number" ? "any" : undefined}
              min={column.type === "number" ? column.minimum : undefined}
              max={column.type === "number" ? column.maximum : undefined}
              maxLength={column.type === "text" ? column.maxLength : undefined}
              value={String(form.values[column.id] ?? "")}
              required={column.required}
              onChange={(event) => form.setValue(column.id, event.currentTarget.value)}
            />
          )}
        </label>
      ))}
      {form.validationError || errorMessage ? (
        <p role="alert" className="text-sm text-failure">
          {form.validationError ?? errorMessage}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" isLoading={isSaving}>
          {submitLabel}
        </Button>
        <Button type="button" variant="ghost" disabled={isSaving} onClick={onCancel}>
          {cancelLabel}
        </Button>
      </div>
    </form>
  );
}
