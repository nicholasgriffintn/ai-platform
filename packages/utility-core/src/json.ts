import { isRecord } from "./objects.js";

export function safeParseJson<T = any>(jsonString: string): T | null {
  try {
    return JSON.parse(jsonString) as T;
  } catch {
    return null;
  }
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

export function assertJsonComplexity(
  value: unknown,
  maxDepth = 32,
  maxNodes = 4096,
  maxTextLength = 512 * 1024,
): void {
  const pending = [{ value, depth: 0, ancestors: new Set<object>() }];
  let count = 0;
  let textLength = 0;

  while (pending.length) {
    const item = pending.pop();

    if (!item || ++count > maxNodes || item.depth > maxDepth) {
      throw new Error("JSON structure exceeds its complexity limit");
    }

    if (typeof item.value === "string") {
      textLength += item.value.length;

      if (textLength > maxTextLength) {
        throw new Error("JSON text exceeds its complexity limit");
      }

      continue;
    }

    if (item.value === null || typeof item.value === "boolean") {
      continue;
    }

    if (typeof item.value === "number" && Number.isFinite(item.value)) {
      continue;
    }

    if (!Array.isArray(item.value) && !isRecord(item.value)) {
      throw new Error("Expected a JSON value");
    }

    if (
      !Array.isArray(item.value) &&
      Object.getPrototypeOf(item.value) !== Object.prototype &&
      Object.getPrototypeOf(item.value) !== null
    ) {
      throw new Error("Expected a plain JSON object");
    }

    if (item.ancestors.has(item.value)) {
      throw new Error("JSON structure contains a cycle");
    }

    const ancestors = new Set([...item.ancestors, item.value]);

    for (const [key, child] of Object.entries(item.value)) {
      textLength += key.length;

      if (textLength > maxTextLength) {
        throw new Error("JSON text exceeds its complexity limit");
      }

      if (pending.length + count >= maxNodes) {
        throw new Error("JSON structure exceeds its complexity limit");
      }

      pending.push({ value: child, depth: item.depth + 1, ancestors });
    }
  }
}
