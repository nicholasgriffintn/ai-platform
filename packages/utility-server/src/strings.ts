export function trimTemplateWhitespace(str: string): string {
  return str
    .replace(/[ \t]+/g, " ")
    .replace(/^[ \t]+/gm, "")
    .replace(/\n{3,}/g, "\n\n");
}

export function getUtf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function isCodePointBoundary(value: string, offset: number) {
  const before = value.charCodeAt(offset - 1);
  const after = value.charCodeAt(offset);

  return !(before >= 0xd800 && before <= 0xdbff && after >= 0xdc00 && after <= 0xdfff);
}

export function sliceTextAtCodePointBoundaries(value: string, offset: number, length: number) {
  if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(length) || length < 0) {
    throw new RangeError("Text offsets and lengths must be non-negative integers");
  }

  let start = Math.min(value.length, offset);

  if (!isCodePointBoundary(value, start)) {
    start -= 1;
  }

  let end = Math.min(value.length, start + length);

  if (!isCodePointBoundary(value, end)) {
    end -= 1;
  }

  if (end === start && length > 0 && start < value.length) {
    end = start + ((value.codePointAt(start) ?? 0) > 0xffff ? 2 : 1);
  }

  return { content: value.slice(start, end), start, end };
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
