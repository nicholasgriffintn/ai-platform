import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import z from "zod/v4";

const SUBSCHEMA_MAPS = ["properties", "$defs", "definitions"];
const SUBSCHEMA_LISTS = ["anyOf", "oneOf", "allOf", "prefixItems"];
const SUBSCHEMA_VALUES = ["items", "additionalProperties", "not"];

function isEmptyRecord(value: unknown): boolean {
  return isRecord(value) && Object.keys(value).length === 0;
}

function pruneEmptyAdditionalProperties(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(pruneEmptyAdditionalProperties);
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key, entry]) => key !== "additionalProperties" || !isEmptyRecord(entry))
      .map(([key, entry]) => [key, pruneEmptyAdditionalProperties(entry)]),
  );
}

function subschemas(schema: Record<string, unknown>): unknown[] {
  return [
    ...SUBSCHEMA_MAPS.flatMap((key) => (isRecord(schema[key]) ? Object.values(schema[key]) : [])),
    ...SUBSCHEMA_LISTS.flatMap((key) => (Array.isArray(schema[key]) ? schema[key] : [])),
    ...SUBSCHEMA_VALUES.map((key) => schema[key]).filter(isRecord),
  ];
}

function closeObjectSchemas(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }

  const closed: Record<string, unknown> = { ...value };

  for (const key of SUBSCHEMA_MAPS) {
    const entries = value[key];

    if (isRecord(entries)) {
      closed[key] = Object.fromEntries(
        Object.entries(entries).map(([name, entry]) => [name, closeObjectSchemas(entry)]),
      );
    }
  }

  for (const key of SUBSCHEMA_LISTS) {
    const entries = value[key];

    if (Array.isArray(entries)) {
      closed[key] = entries.map(closeObjectSchemas);
    }
  }

  for (const key of SUBSCHEMA_VALUES) {
    if (isRecord(value[key])) {
      closed[key] = closeObjectSchemas(value[key]);
    }
  }

  if (isRecord(value.properties) && value.additionalProperties === undefined) {
    closed.additionalProperties = false;
  }

  return closed;
}

function isStrictObjectSchema(schema: Record<string, unknown>): boolean {
  if (schema.type !== "object" && !isRecord(schema.properties)) {
    return true;
  }

  const properties = isRecord(schema.properties) ? Object.keys(schema.properties) : [];
  const required = new Set(Array.isArray(schema.required) ? schema.required : []);

  return (
    schema.additionalProperties === false && properties.every((property) => required.has(property))
  );
}

function isStrictSchema(value: unknown): boolean {
  return (
    !isRecord(value) || (isStrictObjectSchema(value) && subschemas(value).every(isStrictSchema))
  );
}

export function toStructuredOutputSchema(schema: Record<string, unknown>): {
  schema: Record<string, unknown>;
  strict: boolean;
} {
  const closed = closeObjectSchemas(flattenObjectRootSchema(schema));
  const structured = isRecord(closed) ? closed : {};

  return { schema: structured, strict: isStrictSchema(structured) };
}

export function toToolInputJsonSchema(inputSchema: z.ZodType): Record<string, unknown> {
  const { $schema: _schema, ...schema } = z.toJSONSchema(inputSchema, { io: "input" });
  const pruned = pruneEmptyAdditionalProperties(flattenObjectRootSchema(schema));

  return isRecord(pruned) ? pruned : {};
}

export function flattenObjectRootSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const alternatives = schema.anyOf;

  if (
    !Array.isArray(alternatives) ||
    alternatives.length === 0 ||
    !alternatives.every((alternative) => isRecord(alternative) && alternative.type === "object")
  ) {
    return schema;
  }

  const objectAlternatives = alternatives.filter(isRecord);
  const { anyOf: _alternatives, ...root } = schema;
  const properties = new Map<string, unknown>(
    isRecord(root.properties) ? Object.entries(root.properties) : [],
  );
  const requiredCounts = new Map<string, number>();

  for (const alternative of objectAlternatives) {
    if (isRecord(alternative.properties)) {
      for (const [key, value] of Object.entries(alternative.properties)) {
        const existing = properties.get(key);

        properties.set(
          key,
          existing === undefined
            ? value
            : {
                anyOf: [
                  ...(isRecord(existing) && Array.isArray(existing.anyOf)
                    ? existing.anyOf
                    : [existing]),
                  value,
                ],
              },
        );
      }
    }

    const required = Array.isArray(alternative.required) ? alternative.required : [];

    for (const key of new Set(required)) {
      if (typeof key === "string") {
        requiredCounts.set(key, (requiredCounts.get(key) ?? 0) + 1);
      }
    }
  }

  const required = [...requiredCounts.entries()]
    .filter(([, count]) => count === objectAlternatives.length)
    .map(([key]) => key);
  const closed = objectAlternatives.every(
    (alternative) => alternative.additionalProperties === false,
  );

  return {
    ...root,
    type: "object",
    properties: Object.fromEntries(properties),
    ...(required.length > 0 ? { required } : {}),
    ...(closed ? { additionalProperties: false } : {}),
  };
}
