import {
  DEFAULT_SITE_EXPORT_TARGET,
  type SiteElement,
  type SiteExportTarget,
  type SitePage,
} from "@ngriffin_uk/polychat-schemas";

import { isSiteComponentType, SITE_CATALOG, type SiteComponentType } from "../catalog.js";
import { siteElementStyleClasses } from "../element-style.js";
import { elementUsesState, isDynamicValue } from "../state.js";
import {
  hasDynamicValue,
  serialiseAction,
  serialiseExpression,
  serialiseVisibility,
  type ExpressionContext,
} from "./expressions.js";
import { indentLines, serialiseJsxAttribute } from "./serialise.js";

export interface RenderedPage {
  jsx: string;
  components: SiteComponentType[];
  usesState: boolean;
  usesRouter: boolean;
}

const EVENT_HANDLERS = {
  press: { prop: "onPress", params: "()" },
  change: { prop: "onChange", params: "(values: any)" },
  submit: { prop: "onSubmit", params: "(values: Record<string, unknown>)" },
} as const;

function serialiseAttributes(element: SiteElement, context: ExpressionContext): string {
  const attributes: string[] = [];

  for (const [key, value] of Object.entries(element.props)) {
    if (isDynamicValue(value) && typeof value.$bindState === "string") {
      attributes.push(`${key}={${serialiseExpression(value)}}`);
      attributes.push(`onChange={(next: any) => set(${JSON.stringify(value.$bindState)}, next)}`);
      continue;
    }

    if (hasDynamicValue(value)) {
      attributes.push(`${key}={${serialiseExpression(value)}}`);
      continue;
    }

    const attribute = serialiseJsxAttribute(key, value);

    if (attribute) {
      attributes.push(attribute);
    }
  }

  for (const [event, binding] of Object.entries(element.on ?? {})) {
    const handler = EVENT_HANDLERS[event as keyof typeof EVENT_HANDLERS];

    attributes.push(`${handler.prop}={${handler.params} => ${serialiseAction(binding, context)}}`);
  }

  return attributes.length ? ` ${attributes.join(" ")}` : "";
}

export function renderPageJsx(page: SitePage): RenderedPage {
  const used = new Set<SiteComponentType>();
  const context: ExpressionContext = { usesRouter: false };
  let usesState = Boolean(page.state && Object.keys(page.state).length > 0);

  const render = (key: string, trail: Set<string>): string => {
    const element = page.elements[key];

    if (!element || trail.has(key) || !isSiteComponentType(element.type)) {
      return "";
    }

    used.add(element.type);
    usesState = usesState || elementUsesState(element);

    const definition = SITE_CATALOG[element.type];
    const attributes = serialiseAttributes(element, context);
    const nextTrail = new Set(trail).add(key);
    const children = definition.acceptsChildren
      ? element.children
          .map((child) => render(child, nextTrail))
          .filter(Boolean)
          .map((child) => indentLines(child, 1))
          .join("\n")
      : "";
    let jsx = children
      ? `<${element.type}${attributes}>\n${children}\n</${element.type}>`
      : `<${element.type}${attributes} />`;
    const styleClasses = siteElementStyleClasses(element.style);

    if (styleClasses) {
      jsx = `<div className=${JSON.stringify(styleClasses)}>\n${indentLines(jsx, 1)}\n</div>`;
    }

    if (element.repeat) {
      const itemKey = element.repeat.key
        ? `String(readItem(item, ${JSON.stringify(element.repeat.key)}) ?? index)`
        : "index";
      const keyed = jsx.replace(/^<([A-Za-z]+)/, `<$1 key={${itemKey}}`);

      jsx = `{(getPath(state, ${JSON.stringify(element.repeat.statePath)}) ?? []).map((item: any, index: number) => (\n${indentLines(keyed, 1)}\n))}`;
    }

    if (element.visible) {
      const guarded = element.repeat ? `<>${jsx}</>` : jsx;

      jsx = `{${serialiseVisibility(element.visible)} && (\n${indentLines(guarded, 1)}\n)}`;
    }

    return jsx;
  };

  let jsx = render(page.root, new Set());

  if (jsx.startsWith("{")) {
    jsx = `<>\n${indentLines(jsx, 1)}\n</>`;
  }

  return { jsx, components: [...used].sort(), usesState, usesRouter: context.usesRouter };
}

function pageFilePath(path: string, target: SiteExportTarget): string {
  const segments = path.split("/").filter(Boolean);

  if (target === "react-router") {
    return segments.length ? `app/routes/${segments.join(".")}.tsx` : "app/routes/home.tsx";
  }

  if (target === "tanstack-router") {
    return segments.length ? `src/routes/${segments.join("/")}.tsx` : "src/routes/index.tsx";
  }

  return segments.length ? `app/${segments.join("/")}/page.tsx` : "app/page.tsx";
}

function renderRouteMetadata(
  page: SitePage,
  target: SiteExportTarget,
  name: string,
): { import: string; declaration: string } {
  if (target === "react-router") {
    return {
      import: 'import type { MetaFunction } from "react-router";\n',
      declaration: `export const meta: MetaFunction = () => [{ title: ${JSON.stringify(page.title)} }];`,
    };
  }

  if (target === "tanstack-router") {
    return {
      import: 'import { createFileRoute } from "@tanstack/react-router";\n',
      declaration: `export const Route = createFileRoute(${JSON.stringify(page.path)})({ component: ${name} });`,
    };
  }

  return {
    import: "",
    declaration: `export const metadata = { title: ${JSON.stringify(page.title)} };`,
  };
}

function renderRouterRuntime(target: SiteExportTarget): { import: string; hook: string } {
  if (target === "react-router") {
    return {
      import: 'import { useNavigate } from "react-router";\n',
      hook: "  const navigate = useNavigate();\n  const router = { push: navigate };\n",
    };
  }

  if (target === "tanstack-router") {
    return {
      import: "",
      hook: "  const router = { push: (href: string) => window.location.assign(href) };\n",
    };
  }

  return {
    import: 'import { useRouter } from "next/navigation";\n',
    hook: "  const router = useRouter();\n",
  };
}

export function renderPageFile(
  page: SitePage,
  target: SiteExportTarget = DEFAULT_SITE_EXPORT_TARGET,
): {
  path: string;
  content: string;
  components: SiteComponentType[];
  usesState: boolean;
} {
  const rendered = renderPageJsx(page);
  const componentImports = rendered.components
    .map((component) => `import ${component} from "@/components/site/${component}";`)
    .join("\n");
  const name = pageComponentName(page.path);
  const routeMetadata = renderRouteMetadata(page, target, name);

  if (!rendered.usesState) {
    return {
      path: pageFilePath(page.path, target),
      components: rendered.components,
      usesState: false,
      content: `${routeMetadata.import}${componentImports}

${routeMetadata.declaration}

${target === "tanstack-router" ? "function" : "export default function"} ${name}() {
  return (
${indentLines(rendered.jsx, 2)}
  );
}
`,
    };
  }

  const routerRuntime = renderRouterRuntime(target);
  const routerImport = rendered.usesRouter ? routerRuntime.import : "";
  const routerHook = rendered.usesRouter ? routerRuntime.hook : "";
  const routeDeclaration = target === "next" ? "" : routeMetadata.declaration;

  return {
    path: pageFilePath(page.path, target),
    components: rendered.components,
    usesState: true,
    content: `"use client";

import { useState } from "react";
${routerImport}${routeMetadata.import}
import { filterItems, getPath, pushPath, readItem, removePath, setPath, uid, type SiteState } from "@/lib/site-state";
${componentImports}

const INITIAL_STATE: SiteState = ${JSON.stringify(page.state ?? {}, null, 2)};

${routeDeclaration}

${target === "tanstack-router" ? "function" : "export default function"} ${name}() {
  const [state, setState] = useState<SiteState>(INITIAL_STATE);
${routerHook}  const set = (path: string, value: unknown) =>
    setState((current) => setPath(current, path, value));
  const toggle = (path: string) =>
    setState((current) => setPath(current, path, !getPath(current, path)));
  const push = (path: string, value: unknown, clear?: string) =>
    setState((current) => {
      const next = pushPath(current, path, value);

      return clear ? setPath(next, clear, "") : next;
    });
  const remove = (path: string, index: number) =>
    setState((current) => removePath(current, path, index));

  return (
${indentLines(rendered.jsx, 2)}
  );
}
`,
  };
}

function pageComponentName(path: string): string {
  const segments = path.split("/").filter(Boolean);

  if (segments.length === 0) {
    return "HomePage";
  }

  const name = segments
    .map((segment) =>
      segment
        .split("-")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(""),
    )
    .join("");

  return `${name.replace(/[^A-Za-z0-9]/g, "")}Page`;
}
