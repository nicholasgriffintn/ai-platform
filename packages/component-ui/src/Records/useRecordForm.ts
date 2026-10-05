import {
  nativeRecordValuesForDefinitionSchema,
  type NativeRecordDefinition,
  type NativeRecordValues,
} from "@ngriffin_uk/polychat-schemas";
import { useState } from "react";

export function useRecordForm(
  definition: NativeRecordDefinition,
  initialValues: NativeRecordValues,
) {
  const [values, setValues] = useState<Record<string, string | boolean>>(() =>
    Object.fromEntries(
      definition.columns.map((column) => [
        column.id,
        column.type === "boolean"
          ? initialValues[column.id] === true
          : String(initialValues[column.id] ?? ""),
      ]),
    ),
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const setValue = (id: string, value: string | boolean) =>
    setValues((current) => ({ ...current, [id]: value }));
  const parse = () => {
    const record = Object.fromEntries(
      definition.columns.map((column) => {
        const value = values[column.id];

        if (column.type === "boolean") {
          return [column.id, value === true];
        }

        if (value === "" && column.type !== "text") {
          return [column.id, null];
        }

        if (column.type === "number") {
          return [column.id, Number(value)];
        }

        return [column.id, value];
      }),
    );
    const parsed = nativeRecordValuesForDefinitionSchema(definition).safeParse(record);

    if (parsed.success) {
      setValidationError(null);

      return parsed.data;
    }

    const issue = parsed.error.issues[0];
    const column = definition.columns.find((item) => item.id === issue?.path[0]);

    setValidationError(`${column?.name ?? "Record"}: ${issue?.message ?? "Check this value"}`);

    return null;
  };

  return { values, setValue, parse, validationError };
}
