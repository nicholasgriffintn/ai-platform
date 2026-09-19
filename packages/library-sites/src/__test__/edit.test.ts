import { describe, expect, it } from "vitest";

import {
  buildDuplicateSiteElementPatches,
  buildMoveSiteElementPatches,
  buildRemoveSiteElementPatches,
  describeSiteOutline,
  listSiteElementAncestors,
} from "../edit.js";
import { applySitePatch } from "../patch.js";
import { validateSiteProject } from "../validate.js";

const page = validateSiteProject({
  pages: {
    home: {
      root: "page",
      elements: {
        page: { type: "Page", props: {}, children: ["hero", "features", "footer"] },
        hero: { type: "Hero", props: { headline: "Hi" }, children: [] },
        features: { type: "Section", props: {}, children: ["heading"] },
        heading: { type: "Heading", props: { text: "Why" }, children: [] },
        footer: { type: "Footer", props: { brand: "Acme" }, children: [] },
      },
    },
  },
}).project.pages.home;

function apply(patches: ReturnType<typeof buildRemoveSiteElementPatches>) {
  const document = { pages: { home: structuredClone(page) } } as Record<string, unknown>;

  for (const patch of patches) {
    applySitePatch(document, patch);
  }

  return validateSiteProject(document).project.pages.home;
}

describe("structural edits", () => {
  it("moves elements within their parent and refuses impossible moves", () => {
    expect(
      apply(buildMoveSiteElementPatches(page, "home", "features", "up")).elements.page.children,
    ).toEqual(["features", "hero", "footer"]);
    expect(buildMoveSiteElementPatches(page, "home", "hero", "up")).toEqual([]);
  });

  it("duplicates a subtree with fresh keys placed after the original", () => {
    const duplicated = apply(buildDuplicateSiteElementPatches(page, "home", "features"));

    expect(duplicated.elements.page.children).toEqual([
      "hero",
      "features",
      "features-copy",
      "footer",
    ]);
    expect(duplicated.elements["features-copy"].children).toEqual(["heading-copy"]);
    expect(duplicated.elements["heading-copy"].props).toEqual({ text: "Why" });
  });

  it("removes a subtree but never the root", () => {
    const removed = apply(buildRemoveSiteElementPatches(page, "home", "features"));

    expect(Object.keys(removed.elements).sort()).toEqual(["footer", "hero", "page"]);
    expect(buildRemoveSiteElementPatches(page, "home", "page")).toEqual([]);
  });

  it("describes ancestry and a compact outline for scoped refinement", () => {
    expect(listSiteElementAncestors(page, "heading")).toEqual(["page", "features", "heading"]);
    expect(
      describeSiteOutline({
        title: "T",
        theme: {
          palette: "neutral",
          font: "sans",
          radius: "md",
          mode: "light",
          direction: "minimal",
          density: "comfortable",
          texture: "clean",
          motion: "restrained",
        },
        capabilities: ["content", "navigation"],
        pages: { home: page },
      }),
    ).toContain(
      '  page: Page\n    hero: Hero "Hi"\n    features: Section\n      heading: Heading "Why"',
    );
  });
});
