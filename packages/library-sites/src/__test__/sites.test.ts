import { describe, expect, it } from "vitest";

import { SITE_CATALOG, SITE_COMPONENT_TYPES } from "../catalog.js";
import { renderPageJsx } from "../codegen/page.js";
import { generateSiteFiles } from "../codegen/project.js";
import { buildSiteExampleStream, describeSiteCatalog } from "../describe.js";
import { applySitePatch, createSitePatchStreamReader } from "../patch.js";
import { resolveSitePlan } from "../plan.js";
import { validateSiteProject } from "../validate.js";

function compileStream(stream: string, chunkSize: number): Record<string, unknown> {
  const reader = createSitePatchStreamReader();
  const document: Record<string, unknown> = {};

  for (let index = 0; index < stream.length; index += chunkSize) {
    for (const patch of reader.push(stream.slice(index, index + chunkSize))) {
      applySitePatch(document, patch);
    }
  }

  for (const patch of reader.flush()) {
    applySitePatch(document, patch);
  }

  return document;
}

describe("site patch stream", () => {
  it("rebuilds the same document regardless of chunk boundaries", () => {
    const stream = `${buildSiteExampleStream()}\n`;
    const whole = compileStream(stream, stream.length);
    const fragmented = compileStream(stream, 7);

    expect(fragmented).toEqual(whole);
    expect(whole.title).toBe("Acme");
  });

  it("ignores prose, fences and malformed lines without losing later patches", () => {
    const reader = createSitePatchStreamReader();
    const patches = reader.push(
      'Here you go:\n```json\n{"op":"add","path":"/title","value":"A"}\nnot json\n{"op":"add","path":"/description"}\n{"op":"add","path":"/pages","value":{}}\n```\n',
    );

    expect(patches.map((patch) => patch.path)).toEqual(["/title", "/pages"]);
    expect(reader.skippedLines()).toBe(3);
  });

  it("supports replace and remove on nested paths and array appends", () => {
    const document: Record<string, unknown> = {
      pages: { home: { elements: { page: { children: ["a"] } } } },
    };

    applySitePatch(document, {
      op: "add",
      path: "/pages/home/elements/page/children/-",
      value: "b",
    });
    applySitePatch(document, {
      op: "replace",
      path: "/pages/home/elements/page/children/0",
      value: "c",
    });
    applySitePatch(document, { op: "remove", path: "/pages/home/elements/page/children/1" });

    expect(document).toEqual({ pages: { home: { elements: { page: { children: ["c"] } } } } });
  });

  it("refuses prototype pollution paths", () => {
    expect(() =>
      applySitePatch({}, { op: "add", path: "/__proto__/polluted", value: true }),
    ).toThrow();
  });
});

describe("validateSiteProject", () => {
  it("repairs a streamed document into a renderable project and reports what it dropped", () => {
    const { project, issues } = validateSiteProject({
      title: "  Acme ",
      theme: { palette: "ocean" },
      pages: {
        home: {
          path: "/",
          title: "Home",
          root: "page",
          elements: {
            page: { type: "Page", props: {}, children: ["hero", "missing", "hero"] },
            hero: { type: "Hero", props: { headline: "Hi", layout: "diagonal" }, children: ["x"] },
            orphan: { type: "Text", props: { text: "lost" }, children: [] },
            bogus: { type: "Carousel", props: {}, children: [] },
          },
        },
      },
    });

    expect(project.title).toBe("Acme");
    expect(project.theme).toEqual({ palette: "ocean", font: "sans", radius: "md", mode: "light" });
    expect(Object.keys(project.pages.home.elements)).toEqual(["page", "hero"]);
    expect(project.pages.home.elements.page.children).toEqual(["hero"]);
    expect(project.pages.home.elements.hero.props).toEqual({ headline: "Hi" });
    expect(issues.map((issue) => issue.message)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Unknown component "Carousel"'),
        expect.stringContaining("Hero props did not validate"),
        expect.stringContaining('Child "missing" is missing'),
        expect.stringContaining("not reachable"),
      ]),
    );
  });

  it("repairs nested prop failures without dropping the surrounding element", () => {
    const { project, issues } = validateSiteProject({
      pages: {
        home: {
          root: "shell",
          elements: {
            shell: {
              type: "AppShell",
              props: {
                brand: "Brew",
                nav: [
                  { label: "Overview", href: "/", icon: "chart" },
                  { label: "Orders", href: "/orders", icon: "coffee-cup" },
                ],
              },
              children: ["features"],
            },
            features: {
              type: "FeatureGrid",
              props: {
                items: [
                  { icon: "zap", title: "Fast", description: "Quick." },
                  { title: "Broken" },
                  { icon: "sparkle-dust", title: "Neat", description: "Tidy." },
                ],
              },
              children: [],
            },
          },
        },
      },
    });
    const shell = project.pages.home.elements.shell.props as { nav: Array<{ icon?: string }> };
    const features = project.pages.home.elements.features.props as {
      items: Array<{ icon?: string; title: string }>;
    };

    expect(shell.nav).toHaveLength(2);
    expect(shell.nav[1].icon).toBeUndefined();
    expect(features.items.map((item) => item.title)).toEqual(["Fast", "Neat"]);
    expect(features.items[1].icon).toBeUndefined();
    expect(issues.filter((issue) => issue.message.includes("did not validate"))).toHaveLength(2);
  });

  it("infers the root when the declared one never arrived", () => {
    const { project } = validateSiteProject({
      pages: {
        home: {
          root: "never",
          elements: {
            page: { type: "Page", props: {}, children: ["t"] },
            t: { type: "Text", props: { text: "x" }, children: [] },
          },
        },
      },
    });

    expect(project.pages.home.root).toBe("page");
    expect(project.pages.home.path).toBe("/");
  });
});

describe("resolveSitePlan", () => {
  it("maps Jev answers to a plan and keeps component briefs single-scope", () => {
    const plan = resolveSitePlan({
      prompt: "a pricing table component",
      answers: {
        kind: { type: "choice", choice: "component", probabilities: {}, confidence: 0.95 },
        scope: { type: "choice", choice: "site", probabilities: {}, confidence: 0.6 },
        complexity: {
          type: "score",
          score: 2.6,
          legend: { 0: "", 1: "", 2: "", 3: "" },
          probabilities: {},
          confidence: 0.8,
        },
        dark: { type: "noul", noul: 0.9 },
        serif: { type: "noul", noul: 0.2 },
      },
    });

    expect(plan.kind).toBe("component");
    expect(plan.scope).toBe("component");
    expect(plan.tier).toBe("high");
    expect(plan.theme.mode).toBe("dark");
    expect(plan.theme.font).toBe("sans");
  });

  it("falls back to heuristics without a decision model", () => {
    const plan = resolveSitePlan({ prompt: "an analytics dashboard for a coffee roaster" });

    expect(plan.kind).toBe("dashboard");
    expect(plan.scope).toBe("page");
    expect(plan.interactive).toBe(true);
    expect(plan.answers).toBeUndefined();
  });
});

describe("codegen", () => {
  it("has a template and a catalogue description for every component", () => {
    const description = describeSiteCatalog();
    const { files } = generateSiteFiles(
      validateSiteProject({
        pages: {
          home: {
            root: "page",
            elements: {
              page: {
                type: "Page",
                props: {},
                children: SITE_COMPONENT_TYPES.filter((t) => t !== "Page").map((t) =>
                  t.toLowerCase(),
                ),
              },
              ...Object.fromEntries(
                SITE_COMPONENT_TYPES.filter((t) => t !== "Page").map((type) => [
                  type.toLowerCase(),
                  { type, props: SITE_CATALOG[type].example, children: [] },
                ]),
              ),
            },
          },
        },
      }).project,
    );

    for (const type of SITE_COMPONENT_TYPES) {
      expect(description).toContain(`- ${type}`);
    }

    expect(files.filter((file) => file.path.startsWith("components/site/")).length).toBe(
      SITE_COMPONENT_TYPES.length + 2,
    );
  });

  it("renders nested JSX with serialised props and hoists client directives", () => {
    const { project } = validateSiteProject({
      title: "Ledger",
      pages: {
        home: {
          path: "/",
          title: "Overview",
          root: "shell",
          elements: {
            shell: {
              type: "AppShell",
              props: { brand: "Ledger", nav: [{ label: "Home", href: "/", active: true }] },
              children: ["tabs"],
            },
            tabs: {
              type: "Tabs",
              props: { tabs: [{ label: "A", value: "a" }] },
              children: ["metric"],
            },
            metric: {
              type: "Metric",
              props: { label: "Revenue", value: "£1", trend: "up" },
              children: [],
            },
          },
        },
        reports: {
          path: "/reports",
          title: "Reports",
          root: "p",
          elements: { p: { type: "Page", props: {}, children: [] } },
        },
      },
    });
    const { jsx, components } = renderPageJsx(project.pages.home);
    const { files } = generateSiteFiles(project);
    const tabs = files.find((file) => file.path === "components/site/Tabs.tsx");

    expect(components).toEqual(["AppShell", "Metric", "Tabs"]);
    expect(jsx).toContain(
      '<AppShell brand="Ledger" nav={[{"label":"Home","href":"/","active":true}]}>',
    );
    expect(jsx).toContain('<Metric label="Revenue" value="£1" trend="up" />');
    expect(files.map((file) => file.path)).toEqual(
      expect.arrayContaining(["app/page.tsx", "app/reports/page.tsx", "app/globals.css"]),
    );
    expect(tabs?.content.startsWith('"use client";')).toBe(true);
  });
});
