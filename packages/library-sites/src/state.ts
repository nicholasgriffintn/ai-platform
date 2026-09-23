import type { SiteActionBinding, SiteElement, SiteVisibility } from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";

export type SiteState = Record<string, unknown>;

export interface SiteScope {
  state: SiteState;
  item?: unknown;
  index?: number;
  form?: Record<string, unknown>;
}

export const SITE_DYNAMIC_KEYS = [
  "$state",
  "$bindState",
  "$item",
  "$index",
  "$id",
  "$form",
] as const;

export function parseStatePath(path: string): string[] {
  return path.split("/").filter(Boolean);
}

export function getStatePath(state: unknown, path: string): unknown {
  let current: unknown = state;

  for (const segment of parseStatePath(path)) {
    if (Array.isArray(current)) {
      current = current[Number(segment)];
    } else if (isRecord(current)) {
      current = current[segment];
    } else {
      return undefined;
    }
  }

  return current;
}

function cloneContainer(
  value: unknown,
  nextSegment: string | undefined,
): Record<string, unknown> | unknown[] {
  if (Array.isArray(value)) {
    return [...value];
  }

  if (isRecord(value)) {
    return { ...value };
  }

  return nextSegment !== undefined && /^\d+$/.test(nextSegment) ? [] : {};
}

export function setStatePath(state: SiteState, path: string, value: unknown): SiteState {
  const segments = parseStatePath(path);

  if (segments.length === 0) {
    return isRecord(value) ? { ...value } : state;
  }

  const root = cloneContainer(state, segments[0]) as SiteState;
  let parent: Record<string, unknown> | unknown[] = root;

  segments.forEach((segment, index) => {
    const last = index === segments.length - 1;
    const key = Array.isArray(parent) ? Number(segment) : segment;

    if (last) {
      (parent as Record<string | number, unknown>)[key] = value;

      return;
    }

    const existing = (parent as Record<string | number, unknown>)[key];
    const next = cloneContainer(existing, segments[index + 1]);

    (parent as Record<string | number, unknown>)[key] = next;
    parent = next;
  });

  return root;
}

export function pushStatePath(state: SiteState, path: string, value: unknown): SiteState {
  const current = getStatePath(state, path);
  const list = Array.isArray(current) ? current : [];

  return setStatePath(state, path, [...list, value]);
}

export function removeStatePath(state: SiteState, path: string, index: number): SiteState {
  const current = getStatePath(state, path);

  if (!Array.isArray(current)) {
    return state;
  }

  return setStatePath(
    state,
    path,
    current.filter((_, position) => position !== index),
  );
}

export function createSiteId(): string {
  return Math.random().toString(36).slice(2, 10);
}

const LIST_MODIFIER_KEYS = new Set(["where", "search"]);

export function isDynamicValue(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) {
    return false;
  }

  const keys = Object.keys(value);
  const dynamic = keys.filter((key) => (SITE_DYNAMIC_KEYS as readonly string[]).includes(key));

  return (
    dynamic.length === 1 &&
    keys.every(
      (key) => key === dynamic[0] || (dynamic[0] === "$state" && LIST_MODIFIER_KEYS.has(key)),
    )
  );
}

function isOpenConstraint(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    value === false ||
    (typeof value === "string" && /^all\b/i.test(value.trim()))
  );
}

const AFFIRMATIVE = new Set(["true", "yes", "1", "on"]);

function matchesConstraint(actual: unknown, expected: unknown): boolean {
  if (expected === true) {
    return actual === true || AFFIRMATIVE.has(String(actual).toLowerCase());
  }

  return String(actual ?? "").toLowerCase() === String(expected).toLowerCase();
}

export interface SiteListSearch {
  query: unknown;
  fields?: string[];
}

export function filterSiteList(
  items: unknown,
  where?: Record<string, unknown>,
  search?: SiteListSearch,
): unknown[] {
  if (!Array.isArray(items)) {
    return [];
  }

  const query = typeof search?.query === "string" ? search.query.trim().toLowerCase() : "";

  return items.filter((item) => {
    if (!isRecord(item)) {
      return true;
    }

    const matchesWhere = Object.entries(where ?? {}).every(
      ([field, expected]) =>
        isOpenConstraint(expected) || matchesConstraint(readItemField(item, field), expected),
    );

    if (!matchesWhere) {
      return false;
    }

    if (!query) {
      return true;
    }

    const fields = search?.fields?.length ? search.fields : Object.keys(item);

    return fields.some((field) =>
      String(readItemField(item, field) ?? "")
        .toLowerCase()
        .includes(query),
    );
  });
}

export function readItemField(item: unknown, field: string): unknown {
  if (field === "" || field === ".") {
    return item;
  }

  return getStatePath(item, `/${field.replace(/\./g, "/")}`);
}

export function resolveDynamicValue(value: unknown, scope: SiteScope): unknown {
  if (isDynamicValue(value)) {
    if ("$state" in value && typeof value.$state === "string") {
      const read = getStatePath(scope.state, value.$state);

      if (!isRecord(value.where) && !isRecord(value.search)) {
        return read;
      }

      const where = isRecord(value.where)
        ? (resolveDynamicValue(value.where, scope) as Record<string, unknown>)
        : undefined;
      const search = isRecord(value.search)
        ? {
            query: resolveDynamicValue(value.search.query, scope),
            fields: Array.isArray(value.search.fields)
              ? value.search.fields.filter((field): field is string => typeof field === "string")
              : undefined,
          }
        : undefined;

      return filterSiteList(read, where, search);
    }

    if ("$bindState" in value && typeof value.$bindState === "string") {
      return getStatePath(scope.state, value.$bindState);
    }

    if ("$item" in value && typeof value.$item === "string") {
      return readItemField(scope.item, value.$item);
    }

    if ("$index" in value) {
      return scope.index;
    }

    if ("$id" in value) {
      return createSiteId();
    }

    if ("$form" in value) {
      return scope.form ?? {};
    }
  }

  if (Array.isArray(value)) {
    return value.map((entry) => resolveDynamicValue(entry, scope));
  }

  if (isRecord(value)) {
    const spread = value.$form === true ? (scope.form ?? {}) : {};
    const own = Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "$form")
        .map(([key, entry]) => [key, resolveDynamicValue(entry, scope)]),
    );

    return { ...spread, ...own };
  }

  return value;
}

export interface ResolvedElementProps {
  props: Record<string, unknown>;
  bindings: Record<string, string>;
}

export function resolveElementProps(
  props: Record<string, unknown>,
  scope: SiteScope,
): ResolvedElementProps {
  const bindings: Record<string, string> = {};
  const resolved: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(props)) {
    if (isDynamicValue(value) && typeof value.$bindState === "string") {
      bindings[key] = value.$bindState;
    }

    resolved[key] = resolveDynamicValue(value, scope);
  }

  return { props: resolved, bindings };
}

function compare(
  actual: unknown,
  condition: { eq?: unknown; neq?: unknown; in?: unknown[]; truthy?: boolean },
): boolean {
  if ("eq" in condition) {
    return actual === condition.eq;
  }

  if ("neq" in condition) {
    return actual !== condition.neq;
  }

  if (condition.in) {
    return condition.in.includes(actual);
  }

  if (condition.truthy === false) {
    return !actual;
  }

  return Boolean(actual);
}

export function evaluateSiteVisibility(
  condition: SiteVisibility | undefined,
  scope: SiteScope,
): boolean {
  if (!condition) {
    return true;
  }

  if ("and" in condition) {
    return condition.and.every((entry) => evaluateSiteVisibility(entry, scope));
  }

  if ("or" in condition) {
    return condition.or.some((entry) => evaluateSiteVisibility(entry, scope));
  }

  if ("not" in condition) {
    return !evaluateSiteVisibility(condition.not, scope);
  }

  const resolved = {
    ...("eq" in condition ? { eq: resolveDynamicValue(condition.eq, scope) } : {}),
    ...("neq" in condition ? { neq: resolveDynamicValue(condition.neq, scope) } : {}),
    ...(condition.in ? { in: resolveDynamicValue(condition.in, scope) as unknown[] } : {}),
    ...(condition.truthy !== undefined ? { truthy: condition.truthy } : {}),
  };

  if ("$state" in condition) {
    return compare(getStatePath(scope.state, condition.$state), resolved);
  }

  return compare(readItemField(scope.item, condition.$item), resolved);
}

export function resolveRepeatItems(element: SiteElement, scope: SiteScope): unknown[] | null {
  if (!element.repeat) {
    return null;
  }

  const items = getStatePath(scope.state, element.repeat.statePath);

  return Array.isArray(items) ? items : [];
}

export function repeatItemKey(item: unknown, index: number, key?: string): string {
  if (key && isRecord(item) && (typeof item[key] === "string" || typeof item[key] === "number")) {
    return String(item[key]);
  }

  return String(index);
}

export interface SiteActionResult {
  state: SiteState;
  navigate?: string;
}

function readPath(params: Record<string, unknown>, name: string): string | null {
  const value = params[name];

  return typeof value === "string" && value.startsWith("/") ? value : null;
}

export function runSiteAction(binding: SiteActionBinding, scope: SiteScope): SiteActionResult {
  const params = resolveDynamicValue(binding.params ?? {}, scope) as Record<string, unknown>;
  const statePath = readPath(params, "statePath");

  switch (binding.action) {
    case "setState":
      return statePath
        ? { state: setStatePath(scope.state, statePath, params.value) }
        : { state: scope.state };
    case "toggleState":
      return statePath
        ? { state: setStatePath(scope.state, statePath, !getStatePath(scope.state, statePath)) }
        : { state: scope.state };
    case "pushState": {
      if (!statePath) {
        return { state: scope.state };
      }

      let state = pushStatePath(scope.state, statePath, params.value);
      const clearStatePath = readPath(params, "clearStatePath");

      if (clearStatePath) {
        state = setStatePath(state, clearStatePath, "");
      }

      return { state };
    }

    case "removeState": {
      const index = typeof params.index === "number" ? params.index : scope.index;

      return statePath && typeof index === "number"
        ? { state: removeStatePath(scope.state, statePath, index) }
        : { state: scope.state };
    }

    case "navigate":
      return {
        state: scope.state,
        ...(typeof params.href === "string" ? { navigate: params.href } : {}),
      };
    default:
      return { state: scope.state };
  }
}

export function collectDynamicPropPaths(value: unknown, prefix: string[] = []): string[] {
  if (isDynamicValue(value)) {
    return [prefix.join(".")];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry, index) =>
      collectDynamicPropPaths(entry, [...prefix, String(index)]),
    );
  }

  if (isRecord(value)) {
    return Object.entries(value).flatMap(([key, entry]) =>
      collectDynamicPropPaths(entry, [...prefix, key]),
    );
  }

  return [];
}

export function elementUsesState(element: SiteElement): boolean {
  return Boolean(
    element.visible ||
    element.repeat ||
    (element.on && Object.keys(element.on).length > 0) ||
    collectDynamicPropPaths(element.props).length > 0,
  );
}
