import type { SitePage } from "@ngriffin_uk/polychat-schemas";

import { isSiteComponentType, SITE_CATALOG, type SiteComponentType } from "../catalog.js";
import { indentLines, serialiseJsxProps } from "./serialise.js";

export interface RenderedPage {
  jsx: string;
  components: SiteComponentType[];
}

export function renderPageJsx(page: SitePage): RenderedPage {
  const used = new Set<SiteComponentType>();
  const visited = new Set<string>();

  const render = (key: string): string => {
    const element = page.elements[key];

    if (!element || visited.has(key) || !isSiteComponentType(element.type)) {
      return "";
    }

    visited.add(key);
    used.add(element.type);

    const definition = SITE_CATALOG[element.type];
    const attributes = serialiseJsxProps(element.props);

    if (!definition.acceptsChildren || element.children.length === 0) {
      return `<${element.type}${attributes} />`;
    }

    const children = element.children
      .map(render)
      .filter(Boolean)
      .map((child) => indentLines(child, 1))
      .join("\n");

    return `<${element.type}${attributes}>\n${children}\n</${element.type}>`;
  };

  const jsx = render(page.root);

  return { jsx, components: [...used].sort() };
}

function pageFilePath(path: string): string {
  const segments = path.split("/").filter(Boolean);

  return segments.length ? `app/${segments.join("/")}/page.tsx` : "app/page.tsx";
}

export function renderPageFile(page: SitePage): {
  path: string;
  content: string;
  components: SiteComponentType[];
} {
  const rendered = renderPageJsx(page);
  const imports = rendered.components
    .map((component) => `import ${component} from "@/components/site/${component}";`)
    .join("\n");
  const content = `${imports}

export const metadata = { title: ${JSON.stringify(page.title)} };

export default function ${pageComponentName(page.path)}() {
  return (
${indentLines(rendered.jsx, 2)}
  );
}
`;

  return { path: pageFilePath(page.path), content, components: rendered.components };
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
