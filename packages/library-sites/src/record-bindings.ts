import type { NativeRecordView, SitePatch, SiteProject } from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";

import { SITE_CATALOG, isSiteComponentType } from "./catalog.js";
import { elementPatchPath } from "./edit.js";

export function buildSiteRecordBindingPatches(
  project: SiteProject,
  views: NativeRecordView[],
  pageId?: string,
  insertView?: NativeRecordView,
): SitePatch[] {
  const patches: SitePatch[] = [{ op: "add", path: "/recordViews", value: views }];
  const ids = new Set(views.map((view) => view.id));

  for (const [id, page] of Object.entries(project.pages)) {
    const removed = new Set(
      Object.entries(page.elements)
        .filter(
          ([, element]) => element.type === "Records" && !ids.has(String(element.props.viewId)),
        )
        .map(([key]) => key),
    );

    for (const [key, element] of Object.entries(page.elements)) {
      if (removed.has(key)) {
        patches.push(
          key === page.root
            ? {
                op: "replace",
                path: elementPatchPath(id, key),
                value: {
                  type: "EmptyState",
                  props: { title: "No live table", description: "Add a record view in Sites" },
                  children: [],
                },
              }
            : { op: "remove", path: elementPatchPath(id, key) },
        );
      } else if (element.children.some((child) => removed.has(child))) {
        patches.push({
          op: "replace",
          path: `${elementPatchPath(id, key)}/children`,
          value: element.children.filter((child) => !removed.has(child)),
        });
      }
    }
  }

  if (insertView) {
    const page = pageId ? project.pages[pageId] : undefined;
    const root = page?.elements[page.root];

    if (
      !pageId ||
      !page ||
      !root ||
      !isSiteComponentType(root.type) ||
      !SITE_CATALOG[root.type].acceptsChildren
    ) {
      throw new Error("Choose a page with a layout container before adding live records");
    }

    const key = `records-${generateId()}`;

    patches.push({
      op: "add",
      path: elementPatchPath(pageId, key),
      value: { type: "Records", props: { viewId: insertView.id }, children: [] },
    });
    patches.push({
      op: "replace",
      path: `${elementPatchPath(pageId, page.root)}/children`,
      value: [...root.children, key],
    });
  }

  return patches;
}
