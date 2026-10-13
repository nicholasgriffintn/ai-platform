import { isRecord, safeParseJson } from "@ngriffin_uk/polychat-utility-core";

import type { ToolFormData, ToolFormField, ToolFormSchema } from "../apps.js";

export function parseToolFormValue(field: ToolFormField, value: unknown): unknown {
  if (!field.valueFormat || value === undefined || value === "") {
    return value;
  }

  if (isRecord(value) || Array.isArray(value)) {
    return value;
  }

  if (
    field.valueFormat === "json-or-text" &&
    typeof value === "string" &&
    !/^\s*[[{]/.test(value)
  ) {
    return value;
  }

  const parsed = typeof value === "string" ? safeParseJson<unknown>(value) : undefined;

  if (!isRecord(parsed) && !Array.isArray(parsed)) {
    throw new Error(`${field.label} must be a valid JSON object or array`);
  }

  return parsed;
}

export function prepareToolFormData(schema: ToolFormSchema, formData: ToolFormData): ToolFormData {
  const data: ToolFormData = { ...formData };

  for (const step of schema.steps) {
    for (const field of step.fields) {
      if (Object.hasOwn(data, field.id)) {
        data[field.id] = parseToolFormValue(field, data[field.id]);
      }
    }
  }

  return data;
}
