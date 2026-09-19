import {
  DEFAULT_SITE_THEME,
  SITE_ELEMENT_KEY_PATTERN,
  SITE_PAGE_ID_PATTERN,
  siteActionBindingSchema,
  siteEventNameSchema,
  siteRepeatSchema,
  siteThemeSchema,
  siteVisibilitySchema,
  type SiteElement,
  type SiteIssue,
  type SitePage,
  type SiteProject,
} from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import type { z } from "zod";

import { getSiteComponentDefinition } from "./catalog.js";
import { collectDynamicPropPaths } from "./state.js";

export interface SiteValidationResult {
  project: SiteProject;
  issues: SiteIssue[];
}

function readString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

const MAX_PROP_REPAIR_ROUNDS = 6;

function deletePropPath(target: Record<string, unknown>, path: readonly PropertyKey[]): void {
  let current: unknown = target;

  for (const segment of path.slice(0, -1)) {
    if (Array.isArray(current)) {
      current = current[Number(segment)];
    } else if (isRecord(current)) {
      current = current[String(segment)];
    } else {
      return;
    }
  }

  const last = path[path.length - 1];

  if (Array.isArray(current) && typeof last === "number") {
    current.splice(last, 1);
  } else if (isRecord(current) && last !== undefined) {
    delete current[String(last)];
  }
}

function pathKey(path: readonly PropertyKey[]): string {
  return path.map(String).join(".");
}

function repairProps(
  schema: z.ZodType,
  rawProps: Record<string, unknown>,
): { props: Record<string, unknown>; messages: string[] } | null {
  const candidate = structuredClone(rawProps);
  const messages: string[] = [];
  const removed = new Set<string>();
  const dynamicPaths = new Set(collectDynamicPropPaths(candidate));
  const isDynamicIssue = (path: readonly PropertyKey[]) =>
    path.some((_, index) => dynamicPaths.has(pathKey(path.slice(0, index + 1))));

  for (let round = 0; round < MAX_PROP_REPAIR_ROUNDS; round += 1) {
    const parsed = schema.safeParse(candidate);

    if (parsed.success) {
      return {
        props: dynamicPaths.size > 0 ? candidate : (parsed.data as Record<string, unknown>),
        messages,
      };
    }

    const issues = parsed.error.issues.filter((issue) => !isDynamicIssue(issue.path));

    if (issues.length === 0) {
      return { props: candidate, messages };
    }

    if (round === 0) {
      messages.push(...issues.map((issue) => `${pathKey(issue.path) || "props"} ${issue.message}`));
    }

    const targets = new Map<string, PropertyKey[]>();

    for (const issue of issues) {
      let path: PropertyKey[] = [...issue.path];

      while (path.length > 0 && removed.has(pathKey(path))) {
        path = path.slice(0, -1);
      }

      if (path.length === 0) {
        return null;
      }

      targets.set(pathKey(path), path);
    }

    const ordered = [...targets.values()].sort((a, b) => {
      if (a.length !== b.length) {
        return b.length - a.length;
      }

      const lastA = a[a.length - 1];
      const lastB = b[b.length - 1];

      return typeof lastA === "number" && typeof lastB === "number" ? lastB - lastA : 0;
    });

    for (const path of ordered) {
      removed.add(pathKey(path));
      deletePropPath(candidate, path);
    }
  }

  return null;
}

type ElementBehaviour = Pick<SiteElement, "visible" | "repeat" | "on">;

function normaliseBehaviour(
  pageId: string,
  key: string,
  raw: Record<string, unknown>,
  issues: SiteIssue[],
): ElementBehaviour {
  const behaviour: ElementBehaviour = {};
  const warn = (field: string, message: string) =>
    issues.push({
      severity: "warning",
      pageId,
      elementKey: key,
      message: `${field} was dropped: ${message}`,
    });

  if (raw.visible !== undefined) {
    const parsed = siteVisibilitySchema.safeParse(raw.visible);

    if (parsed.success) {
      behaviour.visible = parsed.data;
    } else {
      warn("visible", parsed.error.issues[0]?.message ?? "invalid condition");
    }
  }

  if (raw.repeat !== undefined) {
    const parsed = siteRepeatSchema.safeParse(raw.repeat);

    if (parsed.success) {
      behaviour.repeat = parsed.data;
    } else {
      warn("repeat", parsed.error.issues[0]?.message ?? "invalid repeat");
    }
  }

  if (isRecord(raw.on)) {
    const on: NonNullable<SiteElement["on"]> = {};

    for (const [event, binding] of Object.entries(raw.on)) {
      const eventName = siteEventNameSchema.safeParse(event);
      const parsedBinding = siteActionBindingSchema.safeParse(binding);

      if (eventName.success && parsedBinding.success) {
        on[eventName.data] = parsedBinding.data;
      } else {
        warn(
          `on.${event}`,
          parsedBinding.success
            ? "unknown event"
            : (parsedBinding.error.issues[0]?.message ?? "invalid action"),
        );
      }
    }

    if (Object.keys(on).length > 0) {
      behaviour.on = on;
    }
  }

  return behaviour;
}

function normaliseElement(
  pageId: string,
  key: string,
  raw: unknown,
  issues: SiteIssue[],
): SiteElement | null {
  if (!isRecord(raw) || typeof raw.type !== "string") {
    issues.push({ severity: "warning", pageId, elementKey: key, message: "Element has no type" });

    return null;
  }

  const definition = getSiteComponentDefinition(raw.type);

  if (!definition) {
    issues.push({
      severity: "warning",
      pageId,
      elementKey: key,
      message: `Unknown component "${raw.type}"`,
    });

    return null;
  }

  const rawProps = isRecord(raw.props) ? raw.props : {};
  const repaired = repairProps(definition.props, rawProps);

  if (!repaired) {
    issues.push({
      severity: "warning",
      pageId,
      elementKey: key,
      message: `${raw.type} props could not be repaired and the element was dropped`,
    });

    return null;
  }

  if (repaired.messages.length > 0) {
    issues.push({
      severity: "warning",
      pageId,
      elementKey: key,
      message: `${raw.type} props did not validate: ${repaired.messages.slice(0, 3).join("; ")}`,
    });
  }

  const props = repaired.props;

  const behaviour = normaliseBehaviour(pageId, key, raw, issues);
  const children = Array.isArray(raw.children)
    ? raw.children.filter(
        (child): child is string =>
          typeof child === "string" && SITE_ELEMENT_KEY_PATTERN.test(child),
      )
    : [];

  if (children.length > 0 && !definition.acceptsChildren) {
    issues.push({
      severity: "warning",
      pageId,
      elementKey: key,
      message: `${raw.type} does not accept children; ${children.length} dropped`,
    });

    return { type: raw.type, props, children: [], ...behaviour };
  }

  return { type: raw.type, props, children, ...behaviour };
}

function normalisePage(pageId: string, raw: unknown, issues: SiteIssue[]): SitePage | null {
  if (!isRecord(raw)) {
    issues.push({ severity: "warning", pageId, message: "Page is not an object" });

    return null;
  }

  const rawElements = isRecord(raw.elements) ? raw.elements : {};
  const elements: Record<string, SiteElement> = {};

  for (const [key, value] of Object.entries(rawElements)) {
    if (!SITE_ELEMENT_KEY_PATTERN.test(key)) {
      issues.push({
        severity: "warning",
        pageId,
        elementKey: key,
        message: "Element key must be lowercase letters, digits and dashes",
      });
      continue;
    }

    const element = normaliseElement(pageId, key, value, issues);

    if (element) {
      elements[key] = element;
    }
  }

  const referenced = new Set<string>();

  for (const [key, element] of Object.entries(elements)) {
    const seen = new Set<string>();

    element.children = element.children.filter((child) => {
      if (child === key || seen.has(child)) {
        return false;
      }

      seen.add(child);

      if (!(child in elements)) {
        issues.push({
          severity: "warning",
          pageId,
          elementKey: key,
          message: `Child "${child}" is missing and was dropped`,
        });

        return false;
      }

      referenced.add(child);

      return true;
    });
  }

  let root = typeof raw.root === "string" ? raw.root : "";

  if (!(root in elements)) {
    const candidate =
      Object.keys(elements).find((key) => !referenced.has(key) && elements[key].type === "Page") ??
      Object.keys(elements).find((key) => !referenced.has(key));

    if (!candidate) {
      issues.push({ severity: "warning", pageId, message: "Page has no root element" });

      return null;
    }

    if (root) {
      issues.push({
        severity: "warning",
        pageId,
        message: `Root "${root}" is missing; using "${candidate}"`,
      });
    }

    root = candidate;
  }

  const reachable = new Set<string>();
  const stack = [root];

  while (stack.length > 0) {
    const key = stack.pop() as string;

    if (reachable.has(key)) {
      continue;
    }

    reachable.add(key);
    stack.push(...elements[key].children);
  }

  for (const key of Object.keys(elements)) {
    if (!reachable.has(key)) {
      issues.push({
        severity: "warning",
        pageId,
        elementKey: key,
        message: "Element is not reachable from the root and was dropped",
      });
      delete elements[key];
    }
  }

  const path = readString(raw.path, pageId === "home" ? "/" : `/${pageId}`);

  return {
    path: /^\/[a-z0-9\-/]*$/.test(path) ? path : `/${pageId}`,
    title: readString(raw.title, pageId),
    root,
    elements,
    ...(isRecord(raw.state) ? { state: raw.state } : {}),
  };
}

export function validateSiteProject(raw: unknown): SiteValidationResult {
  const issues: SiteIssue[] = [];
  const source = isRecord(raw) ? raw : {};
  const parsedTheme = siteThemeSchema.safeParse(source.theme);
  const theme = parsedTheme.success
    ? parsedTheme.data
    : { ...DEFAULT_SITE_THEME, ...(isRecord(source.theme) ? pickTheme(source.theme) : {}) };
  const pages: SiteProject["pages"] = {};
  const rawPages = isRecord(source.pages) ? source.pages : {};

  for (const [pageId, rawPage] of Object.entries(rawPages)) {
    if (!SITE_PAGE_ID_PATTERN.test(pageId)) {
      issues.push({ severity: "warning", pageId, message: "Page id must be a lowercase slug" });
      continue;
    }

    const page = normalisePage(pageId, rawPage, issues);

    if (page) {
      pages[pageId] = page;
    }
  }

  if (Object.keys(pages).length === 0) {
    issues.push({ severity: "error", message: "The site has no pages" });
  }

  return {
    project: {
      title: readString(source.title, "Untitled"),
      ...(typeof source.description === "string" && source.description.trim()
        ? { description: source.description.trim().slice(0, 400) }
        : {}),
      theme,
      pages,
    },
    issues,
  };
}

function pickTheme(raw: Record<string, unknown>) {
  const partial = siteThemeSchema.partial().safeParse(raw);

  return partial.success ? partial.data : {};
}

export function hasSiteErrors(issues: readonly SiteIssue[]): boolean {
  return issues.some((issue) => issue.severity === "error");
}
