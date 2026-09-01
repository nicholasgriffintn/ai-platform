export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function deepMergeRecords(
  base: Record<string, unknown>,
  next: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...base };

  for (const [key, value] of Object.entries(next)) {
    const existing = merged[key];

    merged[key] = isRecord(existing) && isRecord(value) ? deepMergeRecords(existing, value) : value;
  }

  return merged;
}

export function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function getStringProperty(value: unknown, key: string): string | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const property = value[key];

  return typeof property === "string" ? property : undefined;
}

export function formatUnknownValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }

  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export function parseStringArrayValue(value: unknown): string[] {
  if (typeof value !== "string") {
    return toStringArray(value);
  }

  try {
    return toStringArray(JSON.parse(value));
  } catch {
    return [];
  }
}

export function parseRecordValue(value: unknown): Record<string, unknown> {
  if (isRecord(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(value);

    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}
