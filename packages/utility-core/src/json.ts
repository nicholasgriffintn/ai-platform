import { isRecord } from "./objects.js";
import { humaniseIdentifier } from "./strings.js";

export function safeParseJson<T = any>(jsonString: string): T | null {
  try {
    return JSON.parse(jsonString) as T;
  } catch {
    return null;
  }
}

function isJsonValue(text: string): boolean {
  const trimmed = text.trim();

  return /^[[{]/.test(trimmed) && safeParseJson(trimmed) !== null;
}

export function withoutJsonText(text: string): string {
  if (isJsonValue(text)) {
    return "";
  }

  return text
    .split("\n")
    .filter((line) => !isJsonValue(line))
    .join("\n")
    .trim();
}

function describeField(label: string, text: string): string {
  return text.includes("\n") ? `${label}:\n${text.replace(/^/gm, "  ")}` : `${label}: ${text}`;
}

export function describeValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "string") {
    return isJsonValue(value) ? describeValue(safeParseJson(value)) : value;
  }

  if (Array.isArray(value)) {
    const items = value.map(describeValue).filter(Boolean);

    return items.join(items.some((item) => item.includes("\n")) ? "\n" : ", ");
  }

  if (isRecord(value)) {
    return Object.entries(value)
      .map(([key, item]) => ({ label: humaniseIdentifier(key), text: describeValue(item) }))
      .filter(({ text }) => text)
      .map(({ label, text }) => describeField(label, text))
      .join("\n");
  }

  return String(value);
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Canonical JSON requires finite numbers");
    }

    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }

  if (!isRecord(value)) {
    throw new TypeError("Canonical JSON supports plain JSON values only");
  }

  return `{${Object.keys(value)
    .sort()
    .filter((key) => value[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
    .join(",")}}`;
}

export function parseJsonLines(text: string): unknown[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line): unknown => JSON.parse(line));
}

export function formatJsonLines(values: readonly unknown[]): string {
  return values.map((value) => JSON.stringify(value)).join("\n");
}

export function readBalancedJson(text: string, startIndex: number): string | null {
  const open = text[startIndex];
  const close = open === "[" ? "]" : open === "{" ? "}" : null;

  if (!close) {
    return null;
  }

  let depth = 0;
  let inString = false;

  for (let index = startIndex; index < text.length; index++) {
    const character = text[index];

    if (inString) {
      if (character === "\\") {
        index++;
      } else if (character === '"') {
        inString = false;
      }

      continue;
    }

    if (character === '"') {
      inString = true;
    } else if (character === open) {
      depth++;
    } else if (character === close) {
      depth--;

      if (depth === 0) {
        return text.slice(startIndex, index + 1);
      }
    }
  }

  return null;
}
