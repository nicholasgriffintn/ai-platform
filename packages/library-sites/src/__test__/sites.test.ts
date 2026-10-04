import { describe, expect, it } from "vitest";

import { SITE_CATALOG, SITE_COMPONENT_TYPES } from "../catalog.js";
import { serialiseExpression } from "../codegen/expressions.js";
import { renderPageJsx } from "../codegen/page.js";
import { generateSiteFiles } from "../codegen/project.js";
import { buildSiteExampleStream, describeSiteCatalog } from "../describe.js";
import { applySitePatch, createSitePatchStreamReader } from "../patch.js";
import { resolveSitePlan } from "../plan.js";
import {
  evaluateSiteVisibility,
  resolveDynamicValue,
  resolveElementProps,
  runSiteAction,
} from "../state.js";
import { hasRenderableSiteContent, validateSiteProject } from "../validate.js";

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

  it("streams visible page structure before metadata", () => {
    const paths = buildSiteExampleStream()
      .split("\n")
      .map((line) => JSON.parse(line) as { path: string })
      .map((patch) => patch.path);

    expect(paths.slice(0, 3)).toEqual([
      "/pages/home",
      "/pages/home/elements/page",
      "/pages/home/elements/nav",
    ]);
    expect(paths.indexOf("/title")).toBeGreaterThan(paths.indexOf("/pages/home/elements/nav"));
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
    applySitePatch(document, {
      op: "remove",
      path: "/pages/home/elements/page/children/1",
    });

    expect(document).toEqual({
      pages: { home: { elements: { page: { children: ["c"] } } } },
    });
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
            page: {
              type: "Page",
              props: {},
              children: ["hero", "missing", "hero"],
            },
            hero: {
              type: "Hero",
              props: { headline: "Hi", layout: "diagonal" },
              children: ["x"],
            },
            orphan: { type: "Text", props: { text: "lost" }, children: [] },
            bogus: { type: "Carousel", props: {}, children: [] },
          },
        },
      },
    });

    expect(project.title).toBe("Acme");
    expect(project.theme).toEqual({
      palette: "ocean",
      font: "sans",
      radius: "md",
      mode: "light",
      direction: "minimal",
      density: "comfortable",
      texture: "clean",
      motion: "restrained",
    });
    expect(project.capabilities).toEqual(["content", "navigation"]);
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
    const shell = project.pages.home.elements.shell.props as {
      nav: Array<{ icon?: string }>;
    };
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

  it("does not treat an empty page shell as visible content", () => {
    const shell = validateSiteProject({
      pages: {
        home: {
          root: "page",
          elements: {
            page: { type: "Page", props: {}, children: ["hero"] },
          },
        },
      },
    }).project;
    const visible = validateSiteProject({
      pages: {
        home: {
          root: "page",
          elements: {
            page: { type: "Page", props: {}, children: ["hero"] },
            hero: { type: "Hero", props: { headline: "Hello" }, children: [] },
          },
        },
      },
    }).project;

    expect(hasRenderableSiteContent(shell)).toBe(false);
    expect(hasRenderableSiteContent(visible)).toBe(true);
  });
});

describe("resolveSitePlan", () => {
  it("uses the highest-probability choice when the provider selection disagrees", () => {
    const plan = resolveSitePlan({
      prompt: "a product website",
      answers: {
        kind: {
          type: "choice",
          choice: "landing",
          probabilities: { landing: 0.01, marketing: 0.99 },
          confidence: 0.99,
        },
      },
    });

    expect(plan.kind).toBe("marketing");
  });

  it("maps Jev answers to a plan and keeps component briefs single-scope", () => {
    const plan = resolveSitePlan({
      prompt: "a pricing table component",
      answers: {
        kind: {
          type: "choice",
          choice: "component",
          probabilities: {},
          confidence: 0.95,
        },
        scope: {
          type: "choice",
          choice: "site",
          probabilities: {},
          confidence: 0.6,
        },
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
    const plan = resolveSitePlan({
      prompt: "an analytics dashboard for a coffee roaster",
    });

    expect(plan.kind).toBe("dashboard");
    expect(plan.scope).toBe("page");
    expect(plan.interactive).toBe(true);
    expect(plan.answers).toBeUndefined();
  });

  it("plans application capabilities and a committed design direction", () => {
    const plan = resolveSitePlan({
      prompt: "A futuristic dark shop with product search, filters, accounts and checkout",
      answers: {
        kind: {
          type: "choice",
          choice: "commerce",
          probabilities: {},
          confidence: 0.96,
        },
        direction: {
          type: "choice",
          choice: "futuristic",
          probabilities: {},
          confidence: 0.92,
        },
        texture: {
          type: "choice",
          choice: "glow",
          probabilities: {},
          confidence: 0.9,
        },
        motion: {
          type: "choice",
          choice: "expressive",
          probabilities: {},
          confidence: 0.88,
        },
      },
    });

    expect(plan.kind).toBe("commerce");
    expect(plan.scope).toBe("site");
    expect(plan.theme).toMatchObject({
      direction: "futuristic",
      texture: "glow",
      motion: "expressive",
    });
    expect(plan.capabilities).toEqual(
      expect.arrayContaining(["search", "filtering", "authentication", "commerce", "payments"]),
    );
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

    expect(files.filter((file) => file.path.startsWith("app/components/site/")).length).toBe(
      SITE_COMPONENT_TYPES.length + 3,
    );
    const componentSource = (name: string) =>
      files.find((file) => file.path === `app/components/site/${name}.tsx`)?.content ?? "";
    const globals = files.find((file) => file.path === "app/globals.css")?.content ?? "";

    expect(componentSource("Image")).toContain('cn("h-full w-full object-cover"');
    expect(componentSource("Tabs")).toContain("gap-3 px-2 pt-2");
    expect(componentSource("Tabs")).toContain('role="tabpanel" className="min-w-0"');
    expect(componentSource("Footer")).toContain("grid-cols-2 gap-x-8 gap-y-8");
    expect(componentSource("Footer")).toContain("bg-transparent");
    expect(componentSource("AppShell")).toContain("bg-background text-foreground md:flex");
    expect(componentSource("AppShell")).toContain("border-b bg-background px-6 text-foreground");
    expect(componentSource("ui")).toContain("bg-background text-foreground hover:bg-accent");
    expect(componentSource("ui")).toContain(
      "text-sm text-foreground placeholder:text-muted-foreground",
    );
    expect(globals).not.toContain(".site-surface-contrast .text-muted-foreground");
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
              props: {
                brand: "Ledger",
                nav: [{ label: "Home", href: "/", active: true }],
              },
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
    const tabs = files.find((file) => file.path === "app/components/site/Tabs.tsx");

    expect(components).toEqual(["AppShell", "Metric", "Tabs"]);
    expect(jsx).toContain(
      '<AppShell brand="Ledger" nav={[{"label":"Home","href":"/","active":true}]}>',
    );
    expect(jsx).toContain('<Metric label="Revenue" value="£1" trend="up" />');
    expect(files.map((file) => file.path)).toEqual(
      expect.arrayContaining(["app/routes/home.tsx", "app/routes/reports.tsx", "app/globals.css"]),
    );
    expect(tabs?.content.startsWith('"use client";')).toBe(true);
  });

  it("keeps generated text contextual inside inverted and transparent surfaces", () => {
    const { project } = validateSiteProject({
      title: "Readable",
      pages: {
        home: {
          path: "/",
          title: "Readable",
          root: "page",
          elements: {
            page: { type: "Page", props: {}, children: ["section"] },
            section: {
              type: "Section",
              props: { background: "inverted" },
              children: ["card", "alert"],
            },
            card: {
              type: "Card",
              props: { variant: "outline" },
              children: ["text"],
            },
            text: {
              type: "Text",
              props: { text: "Visible copy" },
              children: [],
            },
            alert: {
              type: "Alert",
              props: { title: "Notice", description: "Visible detail" },
              children: [],
            },
          },
        },
      },
    });
    const { files } = generateSiteFiles(project);
    const source = (name: string) =>
      files.find((file) => file.path === `app/components/site/${name}.tsx`)?.content ?? "";

    expect(source("Text")).toContain('default: ""');
    expect(source("Text")).toContain('muted: "opacity-70"');
    expect(source("Card")).not.toContain('rounded-lg text-card-foreground"');
    expect(source("Alert")).toContain('className="text-sm opacity-70"');
  });

  it("exports the same site to React Router, Next.js and TanStack Router", () => {
    const { project } = validateSiteProject({
      title: "Portable",
      pages: {
        home: {
          path: "/",
          title: "Home",
          root: "page",
          state: { ready: true },
          elements: {
            page: { type: "Page", props: {}, children: ["hero"] },
            hero: {
              type: "Hero",
              props: { headline: "Build anywhere" },
              children: [],
              style: {
                width: "wide",
                spacing: "dramatic",
                surface: "glass",
                motion: "rise",
              },
            },
          },
        },
      },
    });
    const reactRouter = generateSiteFiles(project, "react-router");
    const next = generateSiteFiles(project, "next");
    const tanstack = generateSiteFiles(project, "tanstack-router");

    expect(reactRouter.target).toBe("react-router");
    expect(reactRouter.files.map((file) => file.path)).toEqual(
      expect.arrayContaining(["react-router.config.ts", "app/root.tsx", "app/routes/home.tsx"]),
    );
    expect(next.files.map((file) => file.path)).toEqual(
      expect.arrayContaining(["next.config.ts", "app/layout.tsx", "app/page.tsx"]),
    );
    expect(tanstack.files.map((file) => file.path)).toEqual(
      expect.arrayContaining([
        "vite.config.ts",
        "src/vite-env.d.ts",
        "src/main.tsx",
        "src/routes/index.tsx",
      ]),
    );
    expect(
      reactRouter.files.find((file) => file.path === "app/routes/home.tsx")?.content,
    ).toContain("site-motion-rise");
    expect(next.files.find((file) => file.path === "components/site/link.tsx")?.content).toContain(
      'from "next/link"',
    );
    expect(next.files.find((file) => file.path === "app/page.tsx")?.content).not.toContain(
      "export const metadata",
    );
    expect(tanstack.files.find((file) => file.path === "src/routes/index.tsx")?.content).toContain(
      'from "@tanstack/react-router"',
    );
    expect(tanstack.files.find((file) => file.path === "src/main.tsx")?.content).toContain(
      'import "./globals.css"',
    );
    expect(
      tanstack.files.find((file) => file.path === "src/routes/__root.tsx")?.content,
    ).not.toContain("globals.css");
    expect(tanstack.files.find((file) => file.path === "src/lib/site-state.ts")?.content).toContain(
      "const matchesFilters =",
    );
  });
});

describe("state", () => {
  const page = {
    path: "/",
    title: "Orders",
    root: "page",
    state: {
      tab: "open",
      query: "",
      orders: [
        { id: "o1", customer: "Northwind", status: "open" },
        { id: "o2", customer: "Contoso", status: "paid" },
      ],
    },
    elements: {
      page: {
        type: "Page",
        props: {},
        children: ["tabs", "search", "list", "add"],
      },
      tabs: {
        type: "Tabs",
        props: {
          tabs: [
            { label: "Open", value: "open" },
            { label: "Paid", value: "paid" },
          ],
          value: { $bindState: "/tab" },
        },
        children: [],
      },
      search: {
        type: "Input",
        props: { value: { $bindState: "/query" } },
        children: [],
      },
      list: {
        type: "Card",
        props: { title: { $item: "customer" } },
        repeat: { statePath: "/orders", key: "id" },
        visible: { $item: "status", eq: { $state: "/tab" } },
        children: ["remove"],
      },
      remove: {
        type: "Button",
        props: { label: "Remove" },
        on: {
          press: { action: "removeState", params: { statePath: "/orders" } },
        },
        children: [],
      },
      add: {
        type: "Button",
        props: { label: "Add" },
        on: {
          press: {
            action: "pushState",
            params: {
              statePath: "/orders",
              value: {
                id: { $id: true },
                customer: { $state: "/query" },
                status: "open",
              },
              clearStatePath: "/query",
            },
          },
        },
        children: [],
      },
    },
  };

  it("keeps dynamic props, visibility, repeat and actions through validation", () => {
    const { project, issues } = validateSiteProject({ pages: { home: page } });
    const home = project.pages.home;

    expect(issues).toEqual([]);
    expect(home.elements.tabs.props.value).toEqual({ $bindState: "/tab" });
    expect(home.elements.list.repeat).toEqual({
      statePath: "/orders",
      key: "id",
    });
    expect(home.elements.list.visible).toBeDefined();
    expect(home.elements.add.on?.press?.action).toBe("pushState");
    expect(home.state).toEqual(page.state);
  });

  it("runs actions immutably and resolves dynamic values against scope", () => {
    const scope = { state: page.state, item: page.state.orders[1], index: 1 };

    expect(resolveElementProps({ title: { $item: "customer" } }, scope).props.title).toBe(
      "Contoso",
    );
    expect(resolveElementProps({ value: { $bindState: "/tab" } }, scope)).toEqual({
      props: { value: "open" },
      bindings: { value: "/tab" },
    });
    expect(evaluateSiteVisibility({ $item: "status", eq: "paid" }, scope)).toBe(true);
    expect(evaluateSiteVisibility({ $item: "status", eq: { $state: "/tab" } }, scope)).toBe(false);
    expect(
      evaluateSiteVisibility(
        {
          and: [
            { $state: "/tab", eq: "open" },
            { $state: "/query", truthy: false },
          ],
        },
        scope,
      ),
    ).toBe(true);

    const removed = runSiteAction(
      { action: "removeState", params: { statePath: "/orders" } },
      scope,
    );
    const pushed = runSiteAction(page.elements.add.on.press as never, {
      state: { ...page.state, query: "Fabrikam" },
    });

    expect((removed.state.orders as unknown[]).length).toBe(1);
    expect(page.state.orders.length).toBe(2);
    expect((pushed.state.orders as Array<{ customer: string; id: string }>)[2]).toMatchObject({
      customer: "Fabrikam",
      status: "open",
    });
    expect((pushed.state.orders as Array<{ id: string }>)[2].id).toMatch(/^[a-z0-9]+$/);
    expect(pushed.state.query).toBe("");
    expect(runSiteAction({ action: "navigate", params: { href: "/paid" } }, scope).navigate).toBe(
      "/paid",
    );
  });

  it("compiles state, bindings, visibility, repeat and actions into a client page", () => {
    const { project } = validateSiteProject({ pages: { home: page } });
    const { files } = generateSiteFiles(project);
    const source = files.find((file) => file.path === "app/routes/home.tsx")?.content ?? "";

    expect(source.startsWith('"use client";')).toBe(true);
    expect(source).toContain("const [state, setState] = useState<SiteState>(INITIAL_STATE);");
    expect(source).toContain(
      'value={getPath(state, "/tab")} onChange={(next: any) => set("/tab", next)}',
    );
    expect(source).toContain(
      '(getPath(state, "/orders") ?? []).map((item: any, index: number) => (',
    );
    expect(source).toContain(
      '<Card key={String(readItem(item, "id") ?? index)} title={readItem(item, "customer")}',
    );
    expect(source).toContain('onPress={() => remove("/orders", index)}');
    expect(source).toContain('{readItem(item, "status") === getPath(state, "/tab") && (');
    expect(source).toContain(
      'push("/orders", { "id": uid(), "customer": getPath(state, "/query"), "status": "open" }, "/query")',
    );
    expect(files.some((file) => file.path === "app/lib/site-state.ts")).toBe(true);
  });
});

describe("derived lists", () => {
  const orders = [
    { id: "o1", customer: "Northwind", status: "Open" },
    { id: "o2", customer: "Contoso", status: "Paid" },
    { id: "o3", customer: "Northwind Traders", status: "Paid" },
  ];

  it("filters $state reads by where and search, treating All and empty as open", () => {
    const read = (state: Record<string, unknown>) =>
      resolveDynamicValue(
        {
          $state: "/orders",
          where: { status: { $state: "/status" } },
          search: { query: { $state: "/query" }, fields: ["customer"] },
        },
        { state: { orders, ...state } },
      ) as typeof orders;

    expect(read({ status: "All statuses", query: "" }).map((o) => o.id)).toEqual([
      "o1",
      "o2",
      "o3",
    ]);
    expect(read({ status: "paid", query: "" }).map((o) => o.id)).toEqual(["o2", "o3"]);
    expect(read({ status: "", query: "north" }).map((o) => o.id)).toEqual(["o1", "o3"]);
    expect(read({ status: "Paid", query: "north" }).map((o) => o.id)).toEqual(["o3"]);
    expect(
      (
        resolveDynamicValue(
          { $state: "/rows", where: { priority: { $state: "/only" } } },
          {
            state: {
              rows: [{ priority: "yes" }, { priority: "no" }],
              only: true,
            },
          },
        ) as unknown[]
      ).length,
    ).toBe(1);
    expect(
      (
        resolveDynamicValue(
          { $state: "/rows", where: { priority: { $state: "/only" } } },
          {
            state: {
              rows: [{ priority: "yes" }, { priority: "no" }],
              only: false,
            },
          },
        ) as unknown[]
      ).length,
    ).toBe(2);
  });

  it("spreads submitted form values into pushed items and compiles the same", () => {
    const result = runSiteAction(
      {
        action: "pushState",
        params: {
          statePath: "/orders",
          value: { id: "fixed", status: "open", $form: true },
        },
      },
      {
        state: { orders: [] },
        form: { customer: "Fabrikam", status: "ignored" },
      },
    );

    expect(result.state.orders).toEqual([{ customer: "Fabrikam", id: "fixed", status: "open" }]);
    expect(serialiseExpression({ id: { $id: true }, status: "open", $form: true })).toBe(
      '{ ...values, "id": uid(), "status": "open" }',
    );
    expect(
      serialiseExpression({
        $state: "/orders",
        where: { status: { $state: "/tab" } },
      }),
    ).toBe(
      'filterItems(getPath(state, "/orders"), { "status": getPath(state, "/tab") }, undefined)',
    );
  });
});
