import type { SiteActionBinding, SiteVisibility } from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";

import { isDynamicValue } from "../state.js";

export interface ExpressionContext {
  usesRouter: boolean;
}

export function serialiseExpression(value: unknown): string {
  if (isDynamicValue(value)) {
    if (typeof value.$state === "string") {
      const read = `getPath(state, ${JSON.stringify(value.$state)})`;

      if (!isRecord(value.where) && !isRecord(value.search)) {
        return read;
      }

      const where = isRecord(value.where) ? serialiseExpression(value.where) : "undefined";
      const search = isRecord(value.search)
        ? `{ query: ${serialiseExpression(value.search.query)}, fields: ${JSON.stringify(
            Array.isArray(value.search.fields) ? value.search.fields : undefined,
          )} }`
        : "undefined";

      return `filterItems(${read}, ${where}, ${search})`;
    }

    if (typeof value.$bindState === "string") {
      return `getPath(state, ${JSON.stringify(value.$bindState)})`;
    }

    if (typeof value.$item === "string") {
      return `readItem(item, ${JSON.stringify(value.$item)})`;
    }

    if ("$index" in value) {
      return "index";
    }

    if ("$id" in value) {
      return "uid()";
    }

    return "values";
  }

  if (!hasDynamicValue(value)) {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(serialiseExpression).join(", ")}]`;
  }

  if (isRecord(value)) {
    const entries = Object.entries(value)
      .filter(([key]) => key !== "$form")
      .map(([key, entry]) => `${JSON.stringify(key)}: ${serialiseExpression(entry)}`);

    return `{ ${[...(value.$form === true ? ["...values"] : []), ...entries].join(", ")} }`;
  }

  return JSON.stringify(value);
}

export function hasDynamicValue(value: unknown): boolean {
  if (isDynamicValue(value)) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.some(hasDynamicValue);
  }

  if (isRecord(value)) {
    return value.$form === true || Object.values(value).some(hasDynamicValue);
  }

  return false;
}

function serialiseComparison(
  subject: string,
  condition: { eq?: unknown; neq?: unknown; in?: unknown[]; truthy?: boolean },
): string {
  if ("eq" in condition) {
    return `${subject} === ${serialiseExpression(condition.eq)}`;
  }

  if ("neq" in condition) {
    return `${subject} !== ${serialiseExpression(condition.neq)}`;
  }

  if (condition.in) {
    return `${serialiseExpression(condition.in)}.includes(${subject})`;
  }

  if (condition.truthy === false) {
    return `!${subject}`;
  }

  return `Boolean(${subject})`;
}

export function serialiseVisibility(condition: SiteVisibility): string {
  if ("and" in condition) {
    return `(${condition.and.map(serialiseVisibility).join(" && ")})`;
  }

  if ("or" in condition) {
    return `(${condition.or.map(serialiseVisibility).join(" || ")})`;
  }

  if ("not" in condition) {
    return `!${serialiseVisibility(condition.not)}`;
  }

  if ("$state" in condition) {
    return serialiseComparison(`getPath(state, ${JSON.stringify(condition.$state)})`, condition);
  }

  return serialiseComparison(`readItem(item, ${JSON.stringify(condition.$item)})`, condition);
}

export function serialiseAction(binding: SiteActionBinding, context: ExpressionContext): string {
  const params = binding.params ?? {};
  const statePath = typeof params.statePath === "string" ? JSON.stringify(params.statePath) : null;

  switch (binding.action) {
    case "setState":
      return statePath ? `set(${statePath}, ${serialiseExpression(params.value)})` : "undefined";
    case "toggleState":
      return statePath ? `toggle(${statePath})` : "undefined";
    case "pushState": {
      if (!statePath) {
        return "undefined";
      }

      const clear =
        typeof params.clearStatePath === "string"
          ? `, ${JSON.stringify(params.clearStatePath)}`
          : "";

      return `push(${statePath}, ${serialiseExpression(params.value)}${clear})`;
    }

    case "removeState":
      return statePath
        ? `remove(${statePath}, ${params.index === undefined ? "index" : serialiseExpression(params.index)})`
        : "undefined";
    case "navigate":
      context.usesRouter = true;

      return typeof params.href === "string"
        ? `router.push(${JSON.stringify(params.href)})`
        : "undefined";
    default:
      return "undefined";
  }
}

export function renderSiteStateModule(): string {
  return `export type SiteState = Record<string, any>;

function segments(path: string): string[] {
  return path.split("/").filter(Boolean);
}

export function getPath(state: unknown, path: string): any {
  let current: any = state;

  for (const segment of segments(path)) {
    if (current === null || current === undefined) {
      return undefined;
    }

    current = current[segment];
  }

  return current;
}

export function readItem(item: unknown, field: string): any {
  return field ? getPath(item, "/" + field.replace(/\\./g, "/")) : item;
}

export function setPath(state: SiteState, path: string, value: unknown): SiteState {
  const parts = segments(path);

  if (parts.length === 0) {
    return { ...(value as SiteState) };
  }

  const root: any = Array.isArray(state) ? [...state] : { ...state };
  let parent: any = root;

  parts.forEach((segment, index) => {
    if (index === parts.length - 1) {
      parent[segment] = value;

      return;
    }

    const existing = parent[segment];
    const next = Array.isArray(existing) ? [...existing] : existing && typeof existing === "object" ? { ...existing } : {};

    parent[segment] = next;
    parent = next;
  });

  return root;
}

export function pushPath(state: SiteState, path: string, value: unknown): SiteState {
  const current = getPath(state, path);

  return setPath(state, path, [...(Array.isArray(current) ? current : []), value]);
}

export function removePath(state: SiteState, path: string, index: number): SiteState {
  const current = getPath(state, path);

  return Array.isArray(current)
    ? setPath(state, path, current.filter((_, position) => position !== index))
    : state;
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function isOpen(value: unknown): boolean {
  return value === undefined || value === null || value === "" || value === false || (typeof value === "string" && /^all\\b/i.test(value.trim()));
}

const AFFIRMATIVE = new Set(["true", "yes", "1", "on"]);

function matches(actual: unknown, expected: unknown): boolean {
  if (expected === true) {
    return actual === true || AFFIRMATIVE.has(String(actual).toLowerCase());
  }

  return String(actual ?? "").toLowerCase() === String(expected).toLowerCase();
}

export function filterItems(
  items: unknown,
  where?: Record<string, unknown>,
  search?: { query: unknown; fields?: string[] },
): any[] {
  if (!Array.isArray(items)) {
    return [];
  }

  const query = typeof search?.query === "string" ? search.query.trim().toLowerCase() : "";

  return items.filter((item) => {
    const record = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const matchesFilters = Object.entries(where ?? {}).every(
      ([field, expected]) => isOpen(expected) || matches(readItem(record, field), expected),
    );

    if (!matchesFilters) {
      return false;
    }

    if (!query) {
      return true;
    }

    const fields = search?.fields?.length ? search.fields : Object.keys(record);

    return fields.some((field) => String(readItem(record, field) ?? "").toLowerCase().includes(query));
  });
}
`;
}
