export function trimTemplateWhitespace(str: string): string {
  // Replace multiple spaces with a single space
  // Remove spaces at the start of each line (common in template literals)
  // Remove multiple consecutive empty lines
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
