export function serialiseJsxAttribute(key: string, value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === "string") {
    return `${key}=${JSON.stringify(value)}`;
  }

  if (typeof value === "boolean") {
    return value ? key : `${key}={false}`;
  }

  if (typeof value === "number") {
    return `${key}={${String(value)}}`;
  }

  return `${key}={${JSON.stringify(value)}}`;
}

export function serialiseJsxProps(props: Record<string, unknown>): string {
  const attributes = Object.entries(props)
    .map(([key, value]) => serialiseJsxAttribute(key, value))
    .filter((attribute): attribute is string => attribute !== null);

  return attributes.length ? ` ${attributes.join(" ")}` : "";
}

export function indentLines(source: string, depth: number): string {
  const prefix = "  ".repeat(depth);

  return source
    .split("\n")
    .map((line) => (line ? `${prefix}${line}` : line))
    .join("\n");
}
