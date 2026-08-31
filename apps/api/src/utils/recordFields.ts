import { isRecord } from "./objects";

export function readRecordField(value: unknown, fieldName: string): unknown {
  if (!isRecord(value)) {
    return undefined;
  }

  return value[fieldName];
}

export function readRecordObjectField(value: unknown, fieldName: string): Record<string, unknown> {
  const field = readRecordField(value, fieldName);

  return isRecord(field) ? field : {};
}

export function readStringField(value: unknown, fieldName: string): string | undefined {
  const field = readRecordField(value, fieldName);

  return typeof field === "string" ? field : undefined;
}

export function readStringFieldAlias(
  value: unknown,
  fieldNames: readonly string[],
): string | undefined {
  for (const fieldName of fieldNames) {
    const field = readStringField(value, fieldName);

    if (field?.trim()) {
      return field;
    }
  }

  return undefined;
}

export function readNumberField(value: unknown, fieldName: string): number | undefined {
  const field = readRecordField(value, fieldName);

  return typeof field === "number" && Number.isFinite(field) ? field : undefined;
}

export function readNumericField(value: unknown, fieldName: string): number | undefined {
  const field = readRecordField(value, fieldName);

  if (typeof field === "number") {
    return Number.isFinite(field) ? field : undefined;
  }

  if (typeof field !== "string" || !field.trim()) {
    return undefined;
  }

  const parsed = Number(field);

  return Number.isFinite(parsed) ? parsed : undefined;
}

export function readNumberFieldAlias(
  value: unknown,
  fieldNames: readonly string[],
): number | undefined {
  for (const fieldName of fieldNames) {
    const field = readNumberField(value, fieldName);

    if (field !== undefined) {
      return field;
    }
  }

  return undefined;
}

export function findNumericFieldDeep(
  value: unknown,
  fieldNames: readonly string[],
  maxDepth = 3,
): number | undefined {
  if (!isRecord(value) || maxDepth < 0) {
    return undefined;
  }

  for (const fieldName of fieldNames) {
    const field = readNumericField(value, fieldName);

    if (field !== undefined) {
      return field;
    }
  }

  for (const nested of Object.values(value)) {
    const found = findNumericFieldDeep(nested, fieldNames, maxDepth - 1);

    if (found !== undefined) {
      return found;
    }
  }

  return undefined;
}
