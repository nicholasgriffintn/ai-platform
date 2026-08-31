import { isRecord } from "@ngriffin_uk/polychat-utility-core";

export { isRecord };

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}

export function isObjectOrArray(value: unknown): value is Record<string, unknown> | unknown[] {
  return isRecord(value) || Array.isArray(value);
}

export function coerceStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  return typeof value === "string" ? [value] : [];
}

export function coerceStringRecord(value: unknown): Record<string, string> {
  if (!isPlainObject(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(omitNullishValues(value)).map(([key, entryValue]) => [key, String(entryValue)]),
  );
}

export function getStringRecordValue(
  value: Record<string, unknown>,
  key: string,
): string | undefined {
  const field = value[key];

  return typeof field === "string" && field.trim() ? field.trim() : undefined;
}

export function getBooleanRecordValue(
  value: Record<string, unknown>,
  key: string,
): boolean | undefined {
  const field = value[key];

  return typeof field === "boolean" ? field : undefined;
}

export function omitUndefinedValues<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => (item === undefined ? null : omitUndefinedValues(item))) as T;
  }

  if (!isPlainObject(value)) {
    return value;
  }

  const entries = Object.entries(value)
    .filter(([, entryValue]) => entryValue !== undefined)
    .map(([entryKey, entryValue]) => [entryKey, omitUndefinedValues(entryValue)]);

  return Object.fromEntries(entries) as T;
}

export function omitKeys<T extends Record<string, unknown>>(value: T, keys: readonly string[]): T {
  const omitted = new Set<string>(keys);

  return Object.fromEntries(
    Object.entries(value).filter(([entryKey]) => !omitted.has(entryKey)),
  ) as T;
}

export function omitNullishValues<T extends Record<string, unknown>>(
  value: T,
): Record<string, Exclude<T[keyof T], null | undefined>> {
  return Object.fromEntries(
    Object.entries(value).filter(
      ([, entryValue]) => entryValue !== undefined && entryValue !== null,
    ),
  ) as Record<string, Exclude<T[keyof T], null | undefined>>;
}
