import type { SitePlan } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import {
  buildSiteRefineTargetQuestion,
  buildSiteRepairPrompt,
  buildSiteQualityState,
  listSiteRefineTargets,
  resolveSiteQuality,
  resolveSiteRefineIntent,
} from "../quality.js";
import { validateSiteProject } from "../validate.js";

const { project } = validateSiteProject({
  title: "Crumb",
  pages: {
    home: {
      root: "page",
      elements: {
        page: { type: "Page", props: {}, children: ["hero", "faq"] },
        hero: { type: "Hero", props: { headline: "Cakes" }, children: [] },
        faq: { type: "FAQ", props: { headline: "Questions", items: [] }, children: [] },
      },
    },
  },
});
const plan: SitePlan = {
  kind: "landing",
  scope: "page",
  tier: "low",
  tone: "friendly",
  theme: {
    palette: "sand",
    font: "sans",
    radius: "md",
    mode: "light",
    direction: "minimal",
    density: "comfortable",
    texture: "clean",
    motion: "restrained",
  },
  interactive: false,
  capabilities: ["content", "navigation"],
  confidence: 0.8,
};

describe("refine intent", () => {
  it("offers every non-root element as a target and scopes confident tweaks to it", () => {
    const candidates = listSiteRefineTargets(project);
    const question = buildSiteRefineTargetQuestion(candidates);

    expect(candidates.map((candidate) => candidate.elementKey)).toEqual(["hero", "faq"]);
    expect(Object.keys(question?.criteria ?? {})).toEqual(["home:hero", "home:faq"]);

    const scoped = resolveSiteRefineIntent(
      {
        intent: { type: "choice", choice: "tweak", probabilities: {}, confidence: 0.9 },
        target: { type: "choice", choice: "home:faq", probabilities: {}, confidence: 0.8 },
      },
      plan,
      candidates,
    );

    expect(scoped).toMatchObject({
      intent: "tweak",
      tier: "low",
      target: { pageId: "home", elementKey: "faq" },
    });
  });

  it("keeps whole-site refines unscoped and raises the tier for pages and interaction", () => {
    const candidates = listSiteRefineTargets(project);

    expect(
      resolveSiteRefineIntent(
        {
          intent: { type: "choice", choice: "tweak", probabilities: {}, confidence: 0.9 },
          target: { type: "choice", choice: "home:faq", probabilities: {}, confidence: 0.4 },
        },
        plan,
        candidates,
      ).target,
    ).toBeNull();
    expect(
      resolveSiteRefineIntent(
        { intent: { type: "choice", choice: "page", probabilities: {}, confidence: 0.9 } },
        plan,
        candidates,
      ).tier,
    ).toBe("medium");
    expect(
      resolveSiteRefineIntent(
        {
          intent: { type: "choice", choice: "restructure", probabilities: {}, confidence: 0.9 },
          interactive: { type: "noul", noul: 0.9 },
        },
        plan,
        candidates,
      ).tier,
    ).toBe("medium");
    expect(resolveSiteRefineIntent({}, plan, candidates)).toMatchObject({
      intent: "restructure",
      tier: "low",
      target: null,
    });
  });
});

describe("quality", () => {
  it("turns Jev answers into a quality record and a targeted repair prompt", () => {
    const quality = resolveSiteQuality(
      {
        coverage: {
          type: "score",
          score: 1,
          legend: { 0: "", 1: "", 2: "", 3: "" },
          probabilities: {},
          confidence: 0.8,
        },
        placeholders: { type: "noul", noul: 0.7 },
        coherent: { type: "noul", noul: 0.9 },
        readable: { type: "noul", noul: 0.2 },
      },
      [{ severity: "warning", pageId: "home", elementKey: "faq", message: "FAQ items empty" }],
    );

    expect(quality).toMatchObject({
      coverage: 1 / 3,
      placeholders: 0.7,
      readable: 0.2,
      repairs: 1,
      needsRepair: true,
      repairConfidence: 0.8,
    });

    const prompt = buildSiteRepairPrompt("A bakery site with a menu", quality, [
      { severity: "warning", pageId: "home", elementKey: "faq", message: "FAQ items empty" },
    ]);

    expect(prompt).toContain("covers only part of the brief");
    expect(prompt).toContain("placeholder or filler");
    expect(prompt).not.toContain("do not read as one site");
    expect(prompt).toContain("may not be readable against its surface");
    expect(prompt).toContain("home/faq: FAQ items empty");
  });

  it("does not ask for repairs when the site is sound", () => {
    expect(
      resolveSiteQuality(
        {
          coverage: {
            type: "score",
            score: 3,
            legend: { 0: "", 1: "", 2: "", 3: "" },
            probabilities: {},
            confidence: 0.9,
          },
          placeholders: { type: "noul", noul: 0.1 },
          coherent: { type: "noul", noul: 0.95 },
          readable: { type: "noul", noul: 0.95 },
        },
        [],
      ).needsRepair,
    ).toBe(false);
  });

  it("requests repair for a high-confidence readability risk", () => {
    const quality = resolveSiteQuality(
      {
        coverage: {
          type: "score",
          score: 3,
          legend: { 0: "", 1: "", 2: "", 3: "" },
          probabilities: {},
          confidence: 0.9,
        },
        placeholders: { type: "noul", noul: 0.05 },
        coherent: { type: "noul", noul: 0.95 },
        readable: { type: "noul", noul: 0.02 },
      },
      [],
    );

    expect(quality).toMatchObject({
      readable: 0.02,
      needsRepair: true,
      repairConfidence: 0.96,
    });
  });

  it("samples copy from every page within the quality context budget", () => {
    const { project: multiPage } = validateSiteProject({
      title: "Long site",
      pages: {
        first: {
          path: "/",
          title: "First",
          root: "page",
          elements: {
            page: { type: "Page", props: {}, children: ["body"] },
            body: { type: "Text", props: { text: "early ".repeat(2000) }, children: [] },
          },
        },
        final: {
          path: "/final",
          title: "Final",
          root: "page",
          elements: {
            page: { type: "Page", props: {}, children: ["marker"] },
            marker: {
              type: "Heading",
              props: { text: "LATER_PAGE_MARKER" },
              children: [],
            },
          },
        },
      },
    });
    const state = buildSiteQualityState("Brief", multiPage);

    expect(state.content).toContain("# First (/");
    expect(state.content).toContain("# Final (/final)");
    expect(state.content).toContain("LATER_PAGE_MARKER");
    expect(state.content.length).toBeLessThanOrEqual(6000);
  });
});
