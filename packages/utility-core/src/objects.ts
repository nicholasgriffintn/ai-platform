export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function readPathValues(value: unknown, path: readonly (string | number)[]): unknown[] {
  let values: unknown[] = [value];

  for (const segment of path) {
    const next: unknown[] = [];

    for (const entry of values) {
      if (segment === "*" && Array.isArray(entry)) {
        for (const item of entry) {
          next.push(item);
        }
      } else if (segment === "*" && isRecord(entry)) {
        for (const item of Object.values(entry)) {
          next.push(item);
        }
      } else if (
        Array.isArray(entry) &&
        typeof segment === "number" &&
        Object.hasOwn(entry, segment)
      ) {
        next.push(entry[segment]);
      } else if (isRecord(entry) && Object.hasOwn(entry, segment)) {
        next.push(entry[segment]);
      }
    }

    values = next;
  }

  return values;
}

export function omitMatchingProperties<T extends object>(
  values: Partial<T>,
  baseline: T,
): Partial<T> {
  const remaining = { ...values };

  for (const key in remaining) {
    if (Object.is(remaining[key], baseline[key])) {
      delete remaining[key];
    }
  }

  return remaining;
}

export function omitUndefinedProperties<T extends object>(values: T): Partial<T> {
  const remaining: Partial<T> = { ...values };

  for (const key in remaining) {
    if (remaining[key] === undefined) {
      delete remaining[key];
    }
  }

  return remaining;
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

export function readNonEmptyString(value: unknown): string | undefined {
  const text = readOptionalString(value);

  return text !== undefined && text !== "" ? text : undefined;
}

export function readTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function readNonBlankString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
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

  if (typeof value === "symbol" || typeof value === "function") {
    return String(value);
  }

  try {
    return JSON.stringify(value, null, 2) ?? "";
  } catch {
    return "";
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

export function getNumberProperty(value: unknown, key: string): number | undefined {
  const property = isRecord(value) ? value[key] : undefined;

  return typeof property === "number" && Number.isFinite(property) ? property : undefined;
}

export function getBooleanProperty(value: unknown, key: string): boolean | undefined {
  const property = isRecord(value) ? value[key] : undefined;

  return typeof property === "boolean" ? property : undefined;
}

export function readRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

export function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function containsRecordList(value: unknown, depth = 4): boolean {
  if (Array.isArray(value)) {
    return (
      value.some(isRecord) ||
      (depth > 0 && value.some((item) => containsRecordList(item, depth - 1)))
    );
  }

  return (
    isRecord(value) &&
    depth > 0 &&
    Object.values(value).some((item) => containsRecordList(item, depth - 1))
  );
}

export function readFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

export function readStringArray(value: unknown): string[] {
  return toStringArray(value);
}

export function readTrimmedStringArray(value: unknown): string[] {
  return toStringArray(value)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function extendPreservingAccessors<T extends object, U extends object>(
  base: T,
  extension: U,
): T & U {
  const extended: T & U = Object.create(Object.getPrototypeOf(base));

  return Object.defineProperties(extended, {
    ...Object.getOwnPropertyDescriptors(base),
    ...Object.getOwnPropertyDescriptors(extension),
  });
}

export function readRecordField(value: unknown, fieldName: string): unknown {
  return isRecord(value) ? value[fieldName] : undefined;
}

export function readStringField(value: unknown, fieldName: string): string | undefined {
  const field = readRecordField(value, fieldName);

  return typeof field === "string" ? field : undefined;
}

const COLLECTED_STRING_MIN_WORDS = 3;

export function collectStrings(value: unknown, maxCharacters: number): string {
  const parts: string[] = [];
  let length = 0;
  const visit = (node: unknown): void => {
    if (length >= maxCharacters || node === null || node === undefined) {
      return;
    }

    if (typeof node === "string") {
      const text = node.replace(/\s+/gu, " ").trim();

      if (text.split(" ").length >= COLLECTED_STRING_MIN_WORDS && !/^https?:\/\//u.test(text)) {
        parts.push(text);
        length += text.length + 1;
      }

      return;
    }

    if (Array.isArray(node)) {
      for (const item of node) {
        visit(item);
      }

      return;
    }

    if (typeof node === "object") {
      for (const item of Object.values(node as Record<string, unknown>)) {
        visit(item);
      }
    }
  };

  visit(value);

  const joined = parts.join(" ");

  return joined.length <= maxCharacters ? joined : `${joined.slice(0, maxCharacters - 3)}...`;
}
