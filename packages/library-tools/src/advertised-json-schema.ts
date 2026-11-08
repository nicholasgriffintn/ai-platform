import { canonicalJson, isRecord, uniqueBy } from "@ngriffin_uk/polychat-utility-core";

const SUBSCHEMA_MAPS = [
  "properties",
  "patternProperties",
  "$defs",
  "definitions",
  "dependentSchemas",
];
const SUBSCHEMA_LISTS = ["anyOf", "oneOf", "allOf", "prefixItems"];
const SUBSCHEMA_VALUES = [
  "items",
  "additionalProperties",
  "not",
  "contains",
  "propertyNames",
  "if",
  "then",
  "else",
  "unevaluatedItems",
  "unevaluatedProperties",
];
const SAFE_INTEGER_BOUNDS = new Set<unknown>([Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER]);
const LITERAL_KEYS = new Set(["type", "const", "enum", "default"]);

function isEmptyRecord(value: unknown): boolean {
  return isRecord(value) && Object.keys(value).length === 0;
}

function isNeutralDefault(value: unknown): boolean {
  return (
    value === false ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0) ||
    isEmptyRecord(value)
  );
}

function isStringKeySchema(value: unknown): boolean {
  return isRecord(value) && Object.keys(value).length === 1 && value.type === "string";
}

function isBareAnyOf(value: unknown): value is { anyOf: unknown[] } {
  return isRecord(value) && Object.keys(value).length === 1 && Array.isArray(value.anyOf);
}

function compactSubschema(value: unknown): unknown {
  return isRecord(value) ? compactSchema(value) : value;
}

function compactChildren(schema: Record<string, unknown>): Record<string, unknown> {
  const compacted: Record<string, unknown> = { ...schema };

  for (const key of SUBSCHEMA_MAPS) {
    const entries = schema[key];

    if (isRecord(entries)) {
      compacted[key] = Object.fromEntries(
        Object.entries(entries).map(([name, entry]) => [name, compactSubschema(entry)]),
      );
    }
  }

  for (const key of SUBSCHEMA_LISTS) {
    const entries = schema[key];

    if (Array.isArray(entries)) {
      compacted[key] = entries.map(compactSubschema);
    }
  }

  for (const key of SUBSCHEMA_VALUES) {
    const entry = schema[key];

    compacted[key] = Array.isArray(entry) ? entry.map(compactSubschema) : compactSubschema(entry);
  }

  return compacted;
}

function isNoiseKeyword(key: string, value: unknown): boolean {
  if (value === undefined) {
    return true;
  }

  switch (key) {
    case "$schema":
      return true;
    case "minimum":
    case "maximum":
      return SAFE_INTEGER_BOUNDS.has(value);
    case "default":
      return isNeutralDefault(value);
    case "propertyNames":
      return isStringKeySchema(value);
    case "additionalProperties":
      return value === true || isEmptyRecord(value);
    case "properties":
      return isEmptyRecord(value);
    default:
      return false;
  }
}

function literalValues(schema: unknown): unknown[] | null {
  if (!isRecord(schema) || !Object.keys(schema).every((key) => LITERAL_KEYS.has(key))) {
    return null;
  }

  if ("const" in schema) {
    return [schema.const];
  }

  return Array.isArray(schema.enum) ? schema.enum : null;
}

function mergeLiteralAlternatives(
  alternatives: readonly unknown[],
): Record<string, unknown> | null {
  const values = alternatives.map(literalValues);
  const types = new Set(
    alternatives.map((alternative) => isRecord(alternative) && alternative.type),
  );

  if (values.some((value) => value === null) || types.size !== 1) {
    return null;
  }

  const [type] = types;
  const defaults = uniqueBy(
    alternatives.map((alternative) => (isRecord(alternative) ? alternative.default : undefined)),
    (value) => (value === undefined ? undefined : canonicalJson(value)),
  );

  return {
    ...(typeof type === "string" ? { type } : {}),
    enum: uniqueBy(values.flat(), canonicalJson),
    ...(defaults.length === 1 && defaults[0] !== undefined ? { default: defaults[0] } : {}),
  };
}

function mergeSingleAlternative(
  schema: Record<string, unknown>,
  alternative: unknown,
): Record<string, unknown> | null {
  if (!isRecord(alternative) || "$ref" in alternative) {
    return null;
  }

  const { anyOf: _alternatives, ...rest } = schema;

  return Object.keys(alternative).some((key) => key in rest) ? null : { ...rest, ...alternative };
}

function collapseAnyOf(schema: Record<string, unknown>): Record<string, unknown> {
  if (!Array.isArray(schema.anyOf)) {
    return schema;
  }

  const alternatives = uniqueBy(
    schema.anyOf.flatMap((alternative) =>
      isBareAnyOf(alternative) ? alternative.anyOf : [alternative],
    ),
    canonicalJson,
  );
  const literal = alternatives.length > 1 ? mergeLiteralAlternatives(alternatives) : null;
  const merged = literal ?? (alternatives.length === 1 ? alternatives[0] : null);

  return mergeSingleAlternative(schema, merged) ?? { ...schema, anyOf: alternatives };
}

function compactSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const compacted = Object.fromEntries(
    Object.entries(compactChildren(schema)).filter(([key, value]) => !isNoiseKeyword(key, value)),
  );

  return collapseAnyOf(compacted);
}

export function compactAdvertisedJsonSchema(
  schema: Record<string, unknown>,
): Record<string, unknown> {
  const compacted = compactSchema(schema);

  return isRecord(schema.properties) && compacted.properties === undefined
    ? { ...compacted, properties: {} }
    : compacted;
}
