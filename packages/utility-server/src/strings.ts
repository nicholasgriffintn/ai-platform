export function trimTemplateWhitespace(str: string): string {
  return str
    .replace(/[ \t]+/g, " ")
    .replace(/^[ \t]+/gm, "")
    .replace(/\n{3,}/g, "\n\n");
}

export function getUtf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

export function stripSurroundingQuotes(value: string): string {
  const trimmed = value.trim();
  const isQuoted =
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")));

  return isQuoted ? trimmed.slice(1, -1).trim() : trimmed;
}

export function toStringValue(value: unknown, fallback = ""): string {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }

  return fallback;
}
