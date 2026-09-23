import type { DecisionChoiceAnswer, SiteProject } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { siteElementStyleClasses, SITE_EXPRESSION_CSS } from "../element-style.js";
import {
  buildSiteFastRefineCandidates,
  buildSiteFastRefineQuestion,
  resolveSiteFastRefineCandidate,
  SITE_FAST_REFINE_FALLBACK_ID,
} from "../fast-refine.js";

const project: SiteProject = {
  title: "Crumb",
  theme: {
    palette: "sand",
    font: "sans",
    radius: "md",
    mode: "light",
    direction: "editorial",
    density: "comfortable",
    texture: "clean",
    motion: "restrained",
  },
  capabilities: ["content"],
  pages: {
    home: {
      path: "/",
      title: "Home",
      root: "page",
      elements: {
        page: { type: "Page", props: {}, children: ["heading"] },
        heading: {
          type: "Heading",
          props: { text: "Fresh bread", size: "md" },
          style: { border: "subtle" },
          children: [],
        },
      },
    },
  },
};

const target = { pageId: "home", elementKey: "heading" } as const;

function answer(choice: string, confidence = 0.95): DecisionChoiceAnswer {
  return {
    type: "choice",
    choice,
    probabilities: { [choice]: confidence },
    confidence,
  };
}

describe("fast selected-element refinement", () => {
  it("offers bounded visual and component-prop mutations that preserve existing style", () => {
    const candidates = buildSiteFastRefineCandidates(project, target);
    const blue = candidates.find((candidate) => candidate.id === "background-ocean");
    const large = candidates.find((candidate) => candidate.id === "prop-size-lg");

    expect(blue?.patch).toEqual({
      op: "replace",
      path: "/pages/home/elements/heading/style",
      value: {
        border: "subtle",
        palette: "ocean",
        surface: "primary",
        tone: "inherit",
      },
    });
    expect(large?.patch).toEqual({
      op: "replace",
      path: "/pages/home/elements/heading/props/size",
      value: "lg",
    });
    expect(buildSiteFastRefineQuestion(candidates).criteria).toHaveProperty(
      SITE_FAST_REFINE_FALLBACK_ID,
    );
  });

  it("acts only on a known high-confidence choice and otherwise escalates", () => {
    const candidates = buildSiteFastRefineCandidates(project, target);

    expect(resolveSiteFastRefineCandidate(answer("background-ocean"), candidates)?.id).toBe(
      "background-ocean",
    );
    expect(resolveSiteFastRefineCandidate(answer("background-ocean", 0.89), candidates)).toBeNull();
    expect(
      resolveSiteFastRefineCandidate(
        {
          ...answer("background-ocean"),
          probabilities: { "background-ocean": 0.7, coding_model: 0.3 },
        },
        candidates,
      ),
    ).toBeNull();
    expect(
      resolveSiteFastRefineCandidate(answer(SITE_FAST_REFINE_FALLBACK_ID), candidates),
    ).toBeNull();
    expect(resolveSiteFastRefineCandidate(answer("unknown"), candidates)).toBeNull();
  });

  it("renders local palettes in preview and exported-site CSS", () => {
    expect(siteElementStyleClasses({ palette: "ocean", tone: "primary" })).toContain(
      "site-palette-ocean text-primary",
    );
    expect(siteElementStyleClasses({ surface: "primary" })).toContain("site-surface-override");
    expect(SITE_EXPRESSION_CSS).toContain(".site-palette-ocean {");
    expect(SITE_EXPRESSION_CSS).toContain(".dark .site-palette-ocean {");
    expect(SITE_EXPRESSION_CSS).toContain(".site-surface-override > [data-site-key]");
  });
});
