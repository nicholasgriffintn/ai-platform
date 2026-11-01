import { isRecord, readPathValues } from "@ngriffin_uk/polychat-utility-core";

export const DISCOVER_SIGNAL_LINE_LIMIT = 12;

type SignalPath = readonly (string | number)[];

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
}

export function first(value: unknown, ...paths: readonly SignalPath[]): string {
  for (const path of paths) {
    const found = readPathValues(value, path).find((item) => text(item));

    if (found !== undefined) {
      return text(found);
    }
  }

  return "";
}

export function count(value: unknown, ...paths: readonly SignalPath[]): number {
  const found = Number(first(value, ...paths));

  return Number.isFinite(found) ? found : 0;
}

export function items(result: unknown, ...paths: readonly SignalPath[]): unknown[] {
  for (const path of paths) {
    const [found] = readPathValues(result, path);

    if (Array.isArray(found)) {
      return found;
    }
  }

  return Array.isArray(result) ? result : [];
}

export function records(
  result: unknown,
  ...paths: readonly SignalPath[]
): Record<string, unknown>[] {
  return items(result, ...paths).filter(isRecord);
}

export function lines(
  entries: unknown[],
  render: (entry: Record<string, unknown>) => string,
  limit = DISCOVER_SIGNAL_LINE_LIMIT,
): string[] {
  const seen = new Set<string>();
  const rendered: string[] = [];

  for (const entry of entries) {
    if (!isRecord(entry)) {
      continue;
    }

    const line = render(entry).replace(/\s+/g, " ").trim();

    if (!line || seen.has(line)) {
      continue;
    }

    seen.add(line);
    rendered.push(line);

    if (rendered.length >= limit) {
      break;
    }
  }

  return rendered;
}

export function joinParts(...parts: readonly string[]): string {
  return parts.filter(Boolean).join(" · ");
}

export function describeEngagement(source: string, amount: number, unit: string): string {
  return [source, amount > 0 ? `${amount} ${unit}` : ""].filter(Boolean).join(", ");
}
