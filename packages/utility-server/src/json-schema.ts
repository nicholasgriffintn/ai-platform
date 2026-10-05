import { assertJsonComplexity, isRecord } from "@ngriffin_uk/polychat-utility-core";
import z from "zod/v4";

import { readRecordPath } from "./record-fields.js";

const SCHEMA_MAPS = new Set(["properties", "$defs", "definitions", "dependentSchemas"]);
const SCHEMA_LISTS = new Set(["anyOf", "allOf", "oneOf", "prefixItems"]);
const SCHEMA_CHILDREN = new Set([
  "items",
  "additionalProperties",
  "additionalItems",
  "unevaluatedProperties",
  "contains",
  "not",
  "if",
  "then",
  "else",
  "propertyNames",
]);
const TYPED_RULES = [
  "properties",
  "required",
  "additionalProperties",
  "propertyNames",
  "minProperties",
  "maxProperties",
  "items",
  "prefixItems",
  "minItems",
  "maxItems",
  "uniqueItems",
  "contains",
  "minContains",
  "maxContains",
  "minLength",
  "maxLength",
  "pattern",
  "format",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
];
const LINEAR_CLASS_PATTERN = /^\^(?:\[(?:\\.|[^\]\\])+\]|\\[dDsSwW])[+*?]?\$$/;
const LITERAL_PATTERN = /^\^(?:\\[^0-9k]|[^\\.*+?{}[\]()|])+\$$/;
const schemaType = z.enum(["string", "number", "integer", "boolean", "null", "array", "object"]);
const primitive = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const nodeRules = z.object({
  type: z.union([schemaType, z.array(schemaType).min(1).max(7)]).optional(),
  required: z
    .array(z.string())
    .refine((keys) => new Set(keys).size === keys.length)
    .optional(),
  enum: z.array(primitive).min(1).optional(),
  const: primitive.optional(),
  format: z.string().optional(),
  minProperties: z.int().nonnegative().optional(),
  maxProperties: z.int().nonnegative().optional(),
  minItems: z.int().nonnegative().optional(),
  maxItems: z.int().nonnegative().optional(),
  minContains: z.int().nonnegative().optional(),
  maxContains: z.int().nonnegative().optional(),
  minLength: z.int().nonnegative().optional(),
  maxLength: z.int().nonnegative().optional(),
  minimum: z.number().optional(),
  maximum: z.number().optional(),
  exclusiveMinimum: z.number().optional(),
  exclusiveMaximum: z.number().optional(),
  multipleOf: z.number().positive().optional(),
  uniqueItems: z.boolean().optional(),
});

function readSchemaReference(root: Record<string, unknown>, reference: unknown): unknown {
  if (
    typeof reference !== "string" ||
    !reference.startsWith("#/") ||
    reference.length > 2048 ||
    reference.includes("%")
  ) {
    throw new Error("JSON Schema requires a local JSON pointer reference");
  }

  const path = reference.slice(2).split("/");

  if (path.some((part) => /~(?:[^01]|$)/.test(part))) {
    throw new Error("Invalid JSON Schema reference");
  }

  return readRecordPath(
    root,
    path.map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~")),
  );
}

export function createBoundedJsonSchemaValidator(schema: Record<string, unknown>) {
  assertJsonComplexity(schema);
  let nodes = 0;

  function expand(
    value: unknown,
    ancestors: ReadonlySet<Record<string, unknown>>,
    depth: number,
  ): Record<string, unknown> | boolean {
    if (++nodes > 1024 || depth > 32) {
      throw new Error("JSON Schema exceeds its expanded complexity limit");
    }

    if (typeof value === "boolean") {
      return value;
    }

    if (!isRecord(value) || ancestors.has(value)) {
      throw new Error("JSON Schema requires a finite schema graph");
    }

    nodeRules.parse(value);

    if (
      value.patternProperties !== undefined ||
      value.$dynamicRef !== undefined ||
      value.$dynamicAnchor !== undefined ||
      value.$id !== undefined ||
      value.$vocabulary !== undefined ||
      value.dependencies !== undefined ||
      (value.$schema !== undefined &&
        value.$schema !== "https://json-schema.org/draft/2020-12/schema") ||
      (value.pattern !== undefined &&
        (typeof value.pattern !== "string" ||
          value.pattern.length > 256 ||
          (!LINEAR_CLASS_PATTERN.test(value.pattern) && !LITERAL_PATTERN.test(value.pattern))))
    ) {
      throw new Error("JSON Schema uses an unsupported dialect, reference or regular expression");
    }

    if (value.type === undefined && TYPED_RULES.some((key) => value[key] !== undefined)) {
      throw new Error("JSON Schema validation rules require an explicit type");
    }

    const path = new Set([...ancestors, value]);
    const entries: [string, unknown][] = [];

    for (const [key, child] of Object.entries(value)) {
      if (key === "$ref" || key === "default" || key === "enum" || key === "const") {
        continue;
      }

      let expandedChild: unknown = child;

      if (SCHEMA_MAPS.has(key)) {
        if (!isRecord(child)) {
          throw new Error("JSON Schema requires a schema map");
        }

        expandedChild = Object.fromEntries(
          Object.entries(child).map(([name, definition]) => [
            name,
            expand(definition, path, depth + 1),
          ]),
        );
      } else if (SCHEMA_LISTS.has(key)) {
        if (!Array.isArray(child) || child.length > 32) {
          throw new Error("JSON Schema requires a bounded schema list");
        }

        expandedChild = child.map((definition) => expand(definition, path, depth + 1));
      } else if (SCHEMA_CHILDREN.has(key)) {
        expandedChild = expand(child, path, depth + 1);
      }

      entries.push([key, expandedChild]);
    }

    const expanded: Record<string, unknown> = Object.fromEntries(entries);

    if (value.enum !== undefined || value.const !== undefined) {
      const allOf = Array.isArray(expanded.allOf) ? expanded.allOf : [];

      expanded.allOf = [
        ...allOf,
        ...(value.enum !== undefined ? [{ enum: value.enum }] : []),
        ...(value.const !== undefined ? [{ const: value.const }] : []),
      ];
    }

    if (Array.isArray(expanded.required)) {
      for (const key of expanded.required) {
        const child =
          typeof key === "string" ? readRecordPath(expanded, ["properties", key]) : undefined;

        if (!isRecord(child) && typeof child !== "boolean") {
          throw new Error("JSON Schema required properties need a defined schema");
        }

        assertJsonComplexity(child, 64, 16384, 128 * 1024);

        if (z.fromJSONSchema(child, { registry: z.registry() }).safeParse(undefined).success) {
          throw new Error("JSON Schema required properties need a defined, non-optional schema");
        }
      }
    }

    if (value.$ref !== undefined) {
      return {
        allOf: [expand(readSchemaReference(schema, value.$ref), path, depth + 1), expanded],
      };
    }

    return expanded;
  }

  const expanded = expand(schema, new Set(), 0);

  assertJsonComplexity(expanded, 64, 16384, 128 * 1024);

  return z.fromJSONSchema(expanded, { registry: z.registry() });
}
