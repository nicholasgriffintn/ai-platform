import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { bufferToBase64 } from "@ngriffin_uk/polychat-utility-server/base64";

const ANNOTATION = "x-mcp-header";
const HEADER_PREFIX = "Mcp-Param-";
const HEADER_TOKEN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
const SAFE_HEADER_VALUE = /^[\t\x20-\x7e]+$/;
const SENTINEL_PREFIX = "=?base64?";
const SENTINEL_SUFFIX = "?=";
const ANNOTATABLE_TYPES = new Set(["string", "integer", "boolean"]);
const UNREACHABLE_KEYWORDS = [
  "items",
  "prefixItems",
  "contains",
  "additionalProperties",
  "unevaluatedProperties",
  "unevaluatedItems",
  "propertyNames",
  "patternProperties",
  "dependentSchemas",
  "oneOf",
  "anyOf",
  "allOf",
  "not",
  "if",
  "then",
  "else",
  "$defs",
  "definitions",
] as const;
const NAMED_SCHEMA_KEYWORDS = new Set<string>([
  "patternProperties",
  "dependentSchemas",
  "$defs",
  "definitions",
]);

export interface McpParamHeader {
  name: string;
  path: readonly string[];
}

function subschemas(keyword: string, value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  return NAMED_SCHEMA_KEYWORDS.has(keyword) && isRecord(value) ? Object.values(value) : [value];
}

function isValidAnnotation(schema: Record<string, unknown>, reachable: boolean): boolean {
  const name = schema[ANNOTATION];

  return (
    reachable &&
    typeof name === "string" &&
    HEADER_TOKEN.test(name) &&
    typeof schema.type === "string" &&
    ANNOTATABLE_TYPES.has(schema.type)
  );
}

function collectHeaders(
  schema: unknown,
  path: readonly string[],
  reachable: boolean,
  headers: McpParamHeader[],
): boolean {
  if (!isRecord(schema)) {
    return true;
  }

  if (ANNOTATION in schema) {
    if (path.length === 0 || !isValidAnnotation(schema, reachable)) {
      return false;
    }

    headers.push({ name: String(schema[ANNOTATION]), path });
  }

  const properties = isRecord(schema.properties) ? Object.entries(schema.properties) : [];

  return (
    properties.every(([key, child]) => collectHeaders(child, [...path, key], reachable, headers)) &&
    UNREACHABLE_KEYWORDS.every((keyword) =>
      subschemas(keyword, schema[keyword]).every((child) =>
        collectHeaders(child, path, false, headers),
      ),
    )
  );
}

export function readMcpParamHeaders(inputSchema: unknown): McpParamHeader[] | null {
  const headers: McpParamHeader[] = [];

  if (!collectHeaders(inputSchema, [], true, headers)) {
    return null;
  }

  const names = new Set(headers.map((header) => header.name.toLowerCase()));

  return names.size === headers.length ? headers : null;
}

function readArgument(args: unknown, path: readonly string[]): unknown {
  return path.reduce<unknown>((value, key) => (isRecord(value) ? value[key] : undefined), args);
}

function toHeaderText(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "boolean" || (typeof value === "number" && Number.isSafeInteger(value))) {
    return String(value);
  }

  return undefined;
}

function encodeHeaderValue(value: string): string {
  const isSafe =
    SAFE_HEADER_VALUE.test(value) &&
    value === value.trim() &&
    !(value.startsWith(SENTINEL_PREFIX) && value.endsWith(SENTINEL_SUFFIX));

  if (isSafe) {
    return value;
  }

  return `${SENTINEL_PREFIX}${bufferToBase64(new TextEncoder().encode(value))}${SENTINEL_SUFFIX}`;
}

export function buildMcpParamHeaders(
  headers: readonly McpParamHeader[],
  args: Record<string, unknown>,
): Record<string, string> {
  return Object.fromEntries(
    headers.flatMap(({ name, path }) => {
      const text = toHeaderText(readArgument(args, path));

      return text === undefined ? [] : [[`${HEADER_PREFIX}${name}`, encodeHeaderValue(text)]];
    }),
  );
}
