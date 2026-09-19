import { describe, expect, it } from "vitest";

import {
  buildSiteImagePatch,
  buildSiteImageRewritePatches,
  collectEmptySiteImageSlots,
  collectSiteImageSlots,
} from "../images.js";
import { applySitePatch } from "../patch.js";
import { validateSiteProject } from "../validate.js";

const { project } = validateSiteProject({
  title: "Crumb",
  description: "A bakery in Leeds.",
  pages: {
    home: {
      root: "page",
      elements: {
        page: { type: "Page", props: {}, children: ["hero", "shot", "gallery", "team"] },
        hero: {
          type: "Hero",
          props: { headline: "Hi", layout: "split", image: { alt: "Cakes on a counter" } },
          children: [],
        },
        shot: { type: "Image", props: { alt: "The shop front", aspect: "wide" }, children: [] },
        gallery: {
          type: "Gallery",
          props: {
            items: [
              { alt: "Wedding cake", src: "https://example.com/done.jpg" },
              { alt: "Cupcakes" },
            ],
          },
          children: [],
        },
        team: { type: "Team", props: { members: [{ name: "Sam", role: "Baker" }] }, children: [] },
      },
    },
  },
});

describe("site images", () => {
  it("finds every image slot with its aspect and skips filled ones when asked", () => {
    const slots = collectSiteImageSlots(project);

    expect(slots.map((slot) => [slot.elementKey, slot.aspect, slot.alt])).toEqual([
      ["hero", "video", "Cakes on a counter"],
      ["shot", "wide", "The shop front"],
      ["gallery", "video", "Wedding cake"],
      ["gallery", "video", "Cupcakes"],
      ["team", "square", "Portrait of Sam"],
    ]);
    expect(collectEmptySiteImageSlots(project).map((slot) => slot.alt)).toEqual([
      "Cakes on a counter",
      "The shop front",
      "Cupcakes",
      "Portrait of Sam",
    ]);
  });

  it("patches sources into the right nested positions and can rewrite them later", () => {
    const document = structuredClone(project) as unknown as Record<string, unknown>;

    for (const slot of collectEmptySiteImageSlots(project)) {
      applySitePatch(
        document,
        buildSiteImagePatch(slot, `https://api/outputs/${slot.elementKey}/content`),
      );
    }

    const filled = validateSiteProject(document).project.pages.home.elements;

    expect((filled.hero.props.image as { src: string }).src).toBe(
      "https://api/outputs/hero/content",
    );
    expect(filled.shot.props.src).toBe("https://api/outputs/shot/content");
    expect((filled.gallery.props.items as Array<{ src?: string }>)[1].src).toBe(
      "https://api/outputs/gallery/content",
    );
    expect((filled.team.props.members as Array<{ image: { src: string } }>)[0].image.src).toBe(
      "https://api/outputs/team/content",
    );

    const rewritten = buildSiteImageRewritePatches(validateSiteProject(document).project, (src) =>
      src.startsWith("https://api/") ? src.replace("https://api/outputs/", "/images/") : null,
    );

    expect(rewritten).toHaveLength(4);
    expect(rewritten[0]).toEqual({
      op: "add",
      path: "/pages/home/elements/hero/props/image",
      value: { alt: "Cakes on a counter", src: "/images/hero/content" },
    });
  });
});
