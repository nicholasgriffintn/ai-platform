import {
  listSitePages,
  type SiteElement,
  type SitePage,
  type SitePatch,
  type SiteProject,
} from "@ngriffin_uk/polychat-schemas";

export function findSiteElementParent(page: SitePage, key: string): string | null {
  for (const [candidate, element] of Object.entries(page.elements)) {
    if (element.children.includes(key)) {
      return candidate;
    }
  }

  return null;
}

export function listSiteElementAncestors(page: SitePage, key: string): string[] {
  const trail: string[] = [];
  let current: string | null = key;
  const seen = new Set<string>();

  while (current && !seen.has(current)) {
    seen.add(current);
    trail.unshift(current);
    current = findSiteElementParent(page, current);
  }

  return trail;
}

export function collectSiteElementSubtree(
  page: SitePage,
  key: string,
): Record<string, SiteElement> {
  const subtree: Record<string, SiteElement> = {};
  const stack = [key];

  while (stack.length > 0) {
    const current = stack.pop() as string;
    const element = page.elements[current];

    if (!element || subtree[current]) {
      continue;
    }

    subtree[current] = element;
    stack.push(...element.children);
  }

  return subtree;
}

export function collectSiteElementRefinementContext(page: SitePage, key: string) {
  const ancestorKeys = listSiteElementAncestors(page, key).filter((ancestor) => ancestor !== key);

  return {
    ancestors: Object.fromEntries(
      ancestorKeys.flatMap((ancestor) => {
        const element = page.elements[ancestor];

        return element ? [[ancestor, element] as const] : [];
      }),
    ),
    selected: collectSiteElementSubtree(page, key),
  };
}

function outlineElement(page: SitePage, key: string, depth: number, seen: Set<string>): string[] {
  const element = page.elements[key];

  if (!element || seen.has(key)) {
    return [];
  }

  seen.add(key);

  const label =
    typeof element.props.headline === "string"
      ? element.props.headline
      : typeof element.props.title === "string"
        ? element.props.title
        : typeof element.props.text === "string"
          ? element.props.text
          : typeof element.props.label === "string"
            ? element.props.label
            : "";
  const suffix = label ? ` "${label.slice(0, 40)}"` : "";
  const flags = [
    element.repeat ? "repeat" : "",
    element.visible ? "visible" : "",
    element.on ? "on" : "",
  ]
    .filter(Boolean)
    .join(",");

  return [
    `${"  ".repeat(depth)}${key}: ${element.type}${suffix}${flags ? ` [${flags}]` : ""}`,
    ...element.children.flatMap((child) => outlineElement(page, child, depth + 1, seen)),
  ];
}

export function describeSiteOutline(project: SiteProject): string {
  return listSitePages(project)
    .map(({ id, page }) =>
      [
        `page ${id} (${page.path}) "${page.title}"${page.state ? ` state keys: ${Object.keys(page.state).join(", ")}` : ""}`,
        ...outlineElement(page, page.root, 1, new Set()),
      ].join("\n"),
    )
    .join("\n\n");
}

export function elementPatchPath(pageId: string, key: string, ...rest: string[]): string {
  return ["", "pages", pageId, "elements", key, ...rest].join("/");
}

export function buildSitePropsPatch(
  pageId: string,
  key: string,
  props: Record<string, unknown>,
): SitePatch {
  return { op: "replace", path: elementPatchPath(pageId, key, "props"), value: props };
}

export function buildRemoveSiteElementPatches(
  page: SitePage,
  pageId: string,
  key: string,
): SitePatch[] {
  const parent = findSiteElementParent(page, key);

  if (!parent || key === page.root) {
    return [];
  }

  const subtree = Object.keys(collectSiteElementSubtree(page, key));

  return [
    {
      op: "replace",
      path: elementPatchPath(pageId, parent, "children"),
      value: page.elements[parent].children.filter((child) => child !== key),
    },
    ...subtree.map((removed) => ({
      op: "remove" as const,
      path: elementPatchPath(pageId, removed),
    })),
  ];
}

export function buildMoveSiteElementPatches(
  page: SitePage,
  pageId: string,
  key: string,
  direction: "up" | "down",
): SitePatch[] {
  const parent = findSiteElementParent(page, key);

  if (!parent) {
    return [];
  }

  const children = [...page.elements[parent].children];
  const index = children.indexOf(key);
  const target = direction === "up" ? index - 1 : index + 1;

  if (index < 0 || target < 0 || target >= children.length) {
    return [];
  }

  [children[index], children[target]] = [children[target], children[index]];

  return [{ op: "replace", path: elementPatchPath(pageId, parent, "children"), value: children }];
}

export function buildDuplicateSiteElementPatches(
  page: SitePage,
  pageId: string,
  key: string,
): SitePatch[] {
  const parent = findSiteElementParent(page, key);

  if (!parent) {
    return [];
  }

  const subtree = collectSiteElementSubtree(page, key);
  const rename = new Map<string, string>();
  const taken = new Set(Object.keys(page.elements));

  for (const original of Object.keys(subtree)) {
    let copy = `${original}-copy`;
    let counter = 2;

    while (taken.has(copy)) {
      copy = `${original}-copy-${counter}`;
      counter += 1;
    }

    taken.add(copy);
    rename.set(original, copy);
  }

  const patches: SitePatch[] = Object.entries(subtree).map(([original, element]) => ({
    op: "add",
    path: elementPatchPath(pageId, rename.get(original) as string),
    value: {
      ...structuredClone(element),
      children: element.children.map((child) => rename.get(child) ?? child),
    },
  }));
  const children = [...page.elements[parent].children];
  const index = children.indexOf(key);

  children.splice(index + 1, 0, rename.get(key) as string);
  patches.push({
    op: "replace",
    path: elementPatchPath(pageId, parent, "children"),
    value: children,
  });

  return patches;
}
