import { parseServerSentEventBuffer } from "@ngriffin_uk/polychat-utility-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  tryDecide: vi.fn(),
  stream: vi.fn(),
  loadSiteGenerationModels: vi.fn(),
  resolveSiteGenerationModel: vi.fn(),
  createSite: vi.fn(),
  finaliseSiteGeneration: vi.fn(),
  updateSite: vi.fn(),
  getSite: vi.fn(),
}));

vi.mock("~/infrastructure/ai", () => ({
  ai: { tryDecide: mocks.tryDecide, stream: mocks.stream },
}));
vi.mock("~/modules/sites/application/model", () => ({
  loadSiteGenerationModels: mocks.loadSiteGenerationModels,
  resolveSiteGenerationModel: mocks.resolveSiteGenerationModel,
}));
vi.mock("~/modules/sites/application/records", () => ({
  createSite: mocks.createSite,
  finaliseSiteGeneration: mocks.finaliseSiteGeneration,
  updateSite: mocks.updateSite,
  getSite: mocks.getSite,
}));

import { streamSiteGeneration } from "~/modules/sites/application/generate";

function sseStreamOf(deltas: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      for (const delta of deltas) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ choices: [{ delta: { content: delta } }] })}\n\n`,
          ),
        );
      }

      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
}

async function readEvents(response: Response) {
  const events: Array<Record<string, unknown>> = [];
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer = parseServerSentEventBuffer(buffer + decoder.decode(value, { stream: true }), {
      onEvent: (event: Record<string, unknown>) => events.push(event),
    });
  }

  return events;
}

const modelOutput = [
  '{"op":"add","path":"/title","value":"Crumb"}\n{"op":"add","path":"/pages/home","value":{"path":"/","title":"Home","root":"page","elements":{}}}\n',
  '{"op":"add","path":"/pages/home/elements/page","value":{"type":"Page","props":{},"children":["hero","missing"]}}\n',
  '{"op":"add","path":"/pages/home/elements/hero","value":{"type":"Hero","props":{"headline":"Cakes worth the drive","layout":"nope"},"children":[]}}\n',
  'not a patch\n{"op":"add","path":"/pages/home/elements/bogus","value":{"type":"Carousel","props":{},"children":[]}}',
];

const context = { env: {}, ensureDatabase: () => {}, repositories: {} } as never;
const user = { id: 7, plan_id: "pro" } as never;
const planDecision = {
  provider: "typesafe",
  model: "jev",
  answers: {
    kind: { type: "choice", choice: "landing", probabilities: {}, confidence: 0.9 },
    scope: { type: "choice", choice: "page", probabilities: {}, confidence: 0.8 },
    complexity: {
      type: "score",
      score: 1.2,
      legend: { 0: "", 1: "", 2: "", 3: "" },
      probabilities: {},
      confidence: 0.7,
    },
    palette: { type: "choice", choice: "sunset", probabilities: {}, confidence: 0.6 },
  },
};
const soundQualityDecision = {
  provider: "typesafe",
  model: "jev",
  answers: {
    coverage: {
      type: "score",
      score: 3,
      legend: { 0: "poor", 1: "partial", 2: "near", 3: "complete" },
      probabilities: { 3: 0.95 },
      confidence: 0.95,
    },
    placeholders: { type: "noul", noul: 0.05 },
    coherent: { type: "noul", noul: 0.95 },
    readable: { type: "noul", noul: 0.95 },
  },
};

describe("streamSiteGeneration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tryDecide.mockResolvedValue(null);
    mocks.loadSiteGenerationModels.mockResolvedValue({});
    mocks.resolveSiteGenerationModel.mockResolvedValue({
      model: "test-model",
      provider: "test",
      effort: "low",
    });
    mocks.stream.mockResolvedValue(sseStreamOf(modelOutput));
    mocks.createSite.mockImplementation(async (_scope, input) => ({
      id: "site-1",
      title: input.project.title,
      brief: input.brief,
      projectId: null,
      revision: 1,
      plan: input.plan,
      project: input.project,
      issues: input.issues,
      quality: input.quality,
      turns: [input.turn],
      createdAt: "2026-09-19T00:00:00.000Z",
      updatedAt: null,
    }));
    mocks.finaliseSiteGeneration.mockImplementation(async (_scope, id, revision, input) => ({
      id,
      title: input.project.title,
      brief: input.brief,
      projectId: null,
      revision: revision + 1,
      plan: input.plan,
      project: input.project,
      issues: input.issues,
      quality: input.quality,
      turns: [input.turn],
      createdAt: "2026-09-19T00:00:00.000Z",
      updatedAt: "2026-09-19T00:01:00.000Z",
    }));
  });

  it("classifies with Jev, streams patches as they arrive, repairs the document and saves it", async () => {
    mocks.tryDecide.mockResolvedValueOnce(planDecision).mockResolvedValueOnce(soundQualityDecision);

    const response = await streamSiteGeneration({
      context,
      user,
      request: { prompt: "A landing page for a bakery in Leeds" },
    });
    const events = await readEvents(response);
    const types = events.map((event) => event.type);

    expect(types.slice(0, 3)).toEqual(["phase", "trace", "plan"]);
    expect(types.indexOf("plan")).toBeLessThan(types.indexOf("model"));
    expect(types.filter((type) => type === "patch")).toHaveLength(5);
    expect(events.at(-1)).not.toHaveProperty("error");
    expect(types.slice(-2)).toEqual(["saved", "done"]);
    expect(events.filter((event) => event.type === "saved").map((event) => event.stage)).toEqual([
      "initial",
      "final",
    ]);
    expect(mocks.createSite.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.tryDecide.mock.invocationCallOrder[1],
    );

    const planEvent = events.find((event) => event.type === "plan");
    const plan = planEvent?.plan as Record<string, unknown>;

    expect(plan).toMatchObject({
      kind: "landing",
      scope: "page",
      tier: "low",
    });
    expect(plan).not.toHaveProperty("provider");
    expect(plan).not.toHaveProperty("model");
    expect((plan.theme as Record<string, unknown>).palette).toBe("sunset");
    expect(mocks.resolveSiteGenerationModel).toHaveBeenCalledWith(
      expect.objectContaining({ tier: "low", requestedModel: undefined, availableModels: {} }),
    );
    expect(mocks.loadSiteGenerationModels.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.tryDecide.mock.invocationCallOrder[0],
    );

    const streamRequest = mocks.stream.mock.calls[0][0];

    expect(streamRequest.system).toContain("OUTPUT FORMAT");
    expect(streamRequest.system).toContain("- Hero");
    expect(streamRequest.system).toContain("BRIEF GUIDANCE");
    expect(streamRequest.system).not.toContain("- Metric");
    expect(streamRequest.prompt_cache_key).toMatch(/^sites-generate-/);
    expect(streamRequest.prompt).toContain("A landing page for a bakery in Leeds");

    const saved = mocks.finaliseSiteGeneration.mock.calls[0][3];

    expect(saved.plan).toMatchObject({ provider: "test", model: "test-model" });
    expect(saved.project.title).toBe("Crumb");
    expect(Object.keys(saved.project.pages.home.elements)).toEqual(["page", "hero"]);
    expect(saved.project.pages.home.elements.page.children).toEqual(["hero"]);
    expect(saved.project.pages.home.elements.hero.props).toEqual({
      headline: "Cakes worth the drive",
    });
    expect(saved.turn.trace).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "decision", stage: "plan", provider: "typesafe" }),
        expect.objectContaining({ kind: "generation", stage: "build", model: "test-model" }),
        expect.objectContaining({ kind: "decision", stage: "quality", provider: "typesafe" }),
      ]),
    );
    expect(saved.issues.map((issue: { message: string }) => issue.message)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Carousel"),
        expect.stringContaining('Child "missing"'),
      ]),
    );
    expect(events.at(-1)).toMatchObject({ type: "done", issues: saved.issues });
  });

  it("falls back to a heuristic plan when Jev is unavailable and reports an empty result", async () => {
    mocks.tryDecide.mockResolvedValue(null);
    mocks.stream.mockResolvedValue(sseStreamOf(["I cannot help with that."]));

    const response = await streamSiteGeneration({
      context,
      user,
      request: { prompt: "an analytics dashboard for a coffee roaster" },
    });
    const events = await readEvents(response);

    const planEvent = events.find((event) => event.type === "plan");

    if (!planEvent) {
      throw new Error("Expected a plan event");
    }

    expect(planEvent).toMatchObject({ type: "plan", plan: { kind: "dashboard", tier: "low" } });
    expect((planEvent.plan as Record<string, unknown>).answers).toBeUndefined();
    expect(events[0]).toMatchObject({ type: "phase", phase: "planning" });
    expect(events[1]).toMatchObject({
      type: "trace",
      entry: { kind: "decision", stage: "plan", source: "heuristic" },
    });

    const system = mocks.stream.mock.calls[0][0].system as string;

    expect(system).toContain('"type":"AppShell"');
    expect(system).toContain("- Metric");
    expect(system).not.toContain("- Hero");
    expect(events.at(-1)).toMatchObject({ type: "error", error: "The site has no pages" });
    expect(mocks.createSite).not.toHaveBeenCalled();
  });

  it("refines an existing site by patching its saved project and keeps the original brief", async () => {
    const existingProject = {
      title: "Crumb",
      theme: { palette: "sunset", font: "sans", radius: "md", mode: "light" },
      pages: {
        home: {
          path: "/",
          title: "Home",
          root: "page",
          elements: {
            page: { type: "Page", props: {}, children: ["hero"] },
            hero: { type: "Hero", props: { headline: "Old headline" }, children: [] },
          },
        },
      },
    };

    mocks.getSite.mockResolvedValue({
      id: "site-1",
      title: "Crumb",
      brief: "A landing page for a bakery in Leeds",
      projectId: null,
      revision: 1,
      plan: {
        kind: "landing",
        scope: "page",
        tier: "medium",
        tone: "friendly",
        theme: existingProject.theme,
        interactive: false,
        confidence: 0.9,
      },
      project: existingProject,
      issues: [],
      turns: [],
      createdAt: "2026-09-19T00:00:00.000Z",
      updatedAt: null,
    });
    mocks.stream.mockResolvedValue(
      sseStreamOf([
        '{"op":"replace","path":"/pages/home/elements/hero/props/headline","value":"New headline"}\n',
      ]),
    );
    mocks.updateSite.mockImplementation(async (_scope, id, input) => ({
      id,
      title: input.project.title,
      brief: input.brief,
      projectId: null,
      revision: 2,
      plan: input.plan,
      project: input.project,
      issues: input.issues,
      turns: [input.turn],
      createdAt: "2026-09-19T00:00:00.000Z",
      updatedAt: "2026-09-19T00:01:00.000Z",
    }));

    const response = await streamSiteGeneration({
      context,
      user,
      request: { prompt: "Change the headline", siteId: "site-1" },
    });
    const events = await readEvents(response);

    const intentCall = mocks.tryDecide.mock.calls[0][0];

    expect(intentCall.questions).toHaveProperty("intent");
    expect(Object.keys(intentCall.questions)).toEqual(["intent", "interactive"]);
    expect(intentCall.state.outline).toContain("hero: Hero");
    expect(mocks.stream.mock.calls[0][0].system).toContain("CURRENT DOCUMENT");
    expect(events.map((event) => event.type)).toEqual([
      "phase",
      "trace",
      "plan",
      "intent",
      "phase",
      "model",
      "phase",
      "patch",
      "trace",
      "phase",
      "saved",
      "phase",
      "trace",
      "phase",
      "saved",
      "done",
    ]);
    expect(events.find((event) => event.type === "intent")).toMatchObject({
      type: "intent",
      intent: "restructure",
      target: null,
    });

    const updated = mocks.updateSite.mock.calls[0][2];

    expect(updated.brief).toBe("A landing page for a bakery in Leeds");
    expect(updated.project.pages.home.elements.hero.props.headline).toBe("New headline");
    const savedEvent = events.find((event) => event.type === "saved");

    if (!savedEvent) {
      throw new Error("Expected a saved event");
    }

    expect((savedEvent.site as { revision: number }).revision).toBe(2);
  });

  it("lets Jev apply one high-confidence selected-element visual change without loading a coding model", async () => {
    const existing = {
      id: "site-1",
      title: "Crumb",
      brief: "A bakery site",
      projectId: null,
      revision: 1,
      plan: {
        kind: "landing",
        scope: "page",
        tier: "medium",
        tone: "friendly",
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
        interactive: false,
        capabilities: ["content"],
        confidence: 0.9,
      },
      project: {
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
              page: { type: "Page", props: {}, children: ["hero"] },
              hero: {
                type: "Hero",
                props: { headline: "Bread for Leeds" },
                style: { radius: "lg" },
                children: [],
              },
            },
          },
        },
      },
      issues: [],
      quality: null,
      turns: [],
      createdAt: "2026-09-19T00:00:00.000Z",
      updatedAt: null,
    };

    mocks.getSite.mockResolvedValue(existing);
    mocks.tryDecide.mockResolvedValue({
      provider: "typesafe",
      model: "jev-latest",
      answers: {
        action: {
          type: "choice",
          choice: "background-ocean",
          probabilities: { "background-ocean": 0.96, coding_model: 0.04 },
          confidence: 0.96,
        },
      },
    });
    mocks.updateSite.mockImplementation(async (_scope, id, input) => ({
      ...existing,
      id,
      revision: 2,
      project: input.project,
      issues: input.issues,
      quality: input.quality,
      turns: [input.turn],
    }));

    const events = await readEvents(
      await streamSiteGeneration({
        context,
        user,
        request: {
          prompt: "Make it blue",
          siteId: "site-1",
          target: { pageId: "home", elementKey: "hero" },
        },
      }),
    );

    expect(mocks.tryDecide.mock.calls[0][0].questions).toHaveProperty("action");
    expect(mocks.loadSiteGenerationModels).not.toHaveBeenCalled();
    expect(mocks.resolveSiteGenerationModel).not.toHaveBeenCalled();
    expect(mocks.stream).not.toHaveBeenCalled();
    expect(events.map((event) => event.type)).toEqual([
      "phase",
      "trace",
      "plan",
      "intent",
      "model",
      "patch",
      "phase",
      "saved",
      "done",
    ]);

    const updated = mocks.updateSite.mock.calls[0][2];

    expect(updated.project.pages.home.elements.hero.style).toEqual({
      radius: "lg",
      palette: "ocean",
      surface: "primary",
      tone: "inherit",
    });
    expect(updated.turn).toMatchObject({
      prompt: "Make it blue",
      intent: "tweak",
      provider: "typesafe",
      model: "jev-latest",
      target: { pageId: "home", elementKey: "hero" },
    });
    expect(updated.turn.trace).toEqual([
      expect.objectContaining({ kind: "decision", stage: "refinement", source: "decision" }),
    ]);
  });

  it("scopes a refinement to a selected element with the outline instead of the whole document", async () => {
    mocks.getSite.mockResolvedValue({
      id: "site-1",
      title: "Crumb",
      brief: "brief",
      projectId: null,
      revision: 1,
      plan: {
        kind: "landing",
        scope: "page",
        tier: "medium",
        tone: "friendly",
        theme: { palette: "sunset", font: "sans", radius: "md", mode: "light" },
        interactive: false,
        confidence: 0.9,
      },
      project: {
        title: "Crumb",
        theme: { palette: "sunset", font: "sans", radius: "md", mode: "light" },
        pages: {
          home: {
            path: "/",
            title: "Home",
            root: "page",
            elements: {
              page: { type: "Page", props: {}, children: ["section", "footer"] },
              section: {
                type: "Section",
                props: { background: "inverted" },
                children: ["hero"],
              },
              hero: { type: "Hero", props: { headline: "Old headline" }, children: [] },
              footer: { type: "Footer", props: { brand: "Crumb" }, children: [] },
            },
          },
        },
      },
      issues: [],
      turns: [],
      createdAt: "2026-09-19T00:00:00.000Z",
      updatedAt: null,
    });
    mocks.stream.mockResolvedValue(
      sseStreamOf([
        '{"op":"replace","path":"/pages/home/elements/hero/props/headline","value":"Scoped"}\n',
      ]),
    );
    mocks.updateSite.mockImplementation(async (_scope, id, input) => ({
      id,
      title: "Crumb",
      brief: input.brief,
      projectId: null,
      revision: 2,
      plan: input.plan,
      project: input.project,
      issues: input.issues,
      turns: [input.turn],
      createdAt: "2026-09-19T00:00:00.000Z",
      updatedAt: null,
    }));

    const response = await streamSiteGeneration({
      context,
      user,
      request: {
        prompt: "Punchier",
        siteId: "site-1",
        target: { pageId: "home", elementKey: "hero" },
      },
    });
    const events = await readEvents(response);
    const system = mocks.stream.mock.calls[0][0].system as string;

    expect(system).toContain("SELECTED CONTEXT");
    expect(system).toContain("/pages/home/elements/hero");
    expect(system).toContain('hero: Hero "Old headline"');
    expect(system).toContain('"background":"inverted"');
    expect(system).not.toContain('"brand":"Crumb"');
    expect(events.map((event) => event.type)).toEqual([
      "phase",
      "plan",
      "phase",
      "model",
      "phase",
      "patch",
      "trace",
      "phase",
      "saved",
      "phase",
      "trace",
      "phase",
      "saved",
      "done",
    ]);

    mocks.stream.mockResolvedValueOnce(sseStreamOf(["No patch was produced\n"]));
    const noUpdateEvents = await readEvents(
      await streamSiteGeneration({
        context,
        user,
        request: {
          prompt: "Fix it",
          siteId: "site-1",
          target: { pageId: "home", elementKey: "hero" },
        },
      }),
    );

    expect(noUpdateEvents.find((event) => event.type === "trace" && event.entry)).toMatchObject({
      type: "trace",
      entry: {
        kind: "generation",
        stage: "build",
        outcome: "discarded",
        summary: "No site updates were applied because the response contained no valid patches",
      },
    });

    const missing = await readEvents(
      await streamSiteGeneration({
        context,
        user,
        request: { prompt: "x", siteId: "site-1", target: { pageId: "home", elementKey: "gone" } },
      }),
    );

    expect(missing.at(-1)).toMatchObject({
      type: "error",
      error: expect.stringContaining("no longer exists"),
    });
  });

  it("runs one automatic repair when Jev flags a high-confidence readability risk", async () => {
    const weakQualityDecision = {
      provider: "typesafe",
      model: "jev",
      answers: {
        coverage: {
          type: "score",
          score: 3,
          legend: { 0: "poor", 1: "partial", 2: "near", 3: "complete" },
          probabilities: { 3: 0.96 },
          confidence: 0.96,
        },
        placeholders: { type: "noul", noul: 0.1 },
        coherent: { type: "noul", noul: 0.9 },
        readable: { type: "noul", noul: 0.02 },
      },
    };

    mocks.tryDecide
      .mockResolvedValueOnce(planDecision)
      .mockResolvedValueOnce(weakQualityDecision)
      .mockResolvedValueOnce(soundQualityDecision);
    mocks.stream
      .mockResolvedValueOnce(sseStreamOf(modelOutput))
      .mockResolvedValueOnce(
        sseStreamOf([
          '{"op":"replace","path":"/pages/home/elements/hero/props/headline","value":"Wedding cakes made in Leeds"}\n',
        ]),
      );

    const events = await readEvents(
      await streamSiteGeneration({
        context,
        user,
        request: { prompt: "A landing page for a bakery in Leeds" },
      }),
    );
    const saved = mocks.finaliseSiteGeneration.mock.calls[0][3];

    expect(mocks.stream).toHaveBeenCalledTimes(2);
    expect(mocks.stream.mock.calls[1][0].prompt).toContain(
      "may not be readable against its surface",
    );
    expect(saved.project.pages.home.elements.hero.props.headline).toBe(
      "Wedding cakes made in Leeds",
    );
    expect(saved.turn.trace).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "generation", stage: "repair", outcome: "applied" }),
        expect.objectContaining({ id: expect.stringContaining("post-repair:quality") }),
      ]),
    );
    expect(events.filter((event) => event.type === "patch")).toHaveLength(6);
  });

  it("discards an automatic repair that would invalidate the site", async () => {
    const weakQualityDecision = {
      provider: "typesafe",
      model: "jev",
      answers: {
        coverage: {
          type: "score",
          score: 0,
          legend: { 0: "poor", 1: "partial", 2: "near", 3: "complete" },
          probabilities: { 0: 0.97 },
          confidence: 0.97,
        },
      },
    };

    mocks.tryDecide.mockResolvedValueOnce(planDecision).mockResolvedValueOnce(weakQualityDecision);
    mocks.stream
      .mockResolvedValueOnce(sseStreamOf(modelOutput))
      .mockResolvedValueOnce(sseStreamOf(['{"op":"remove","path":"/pages/home"}\n']));

    const events = await readEvents(
      await streamSiteGeneration({
        context,
        user,
        request: { prompt: "A landing page for a bakery in Leeds" },
      }),
    );
    const saved = mocks.finaliseSiteGeneration.mock.calls[0][3];

    expect(saved.project.pages.home).toBeDefined();
    expect(saved.turn.trace).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "generation", stage: "repair", outcome: "discarded" }),
      ]),
    );
    expect(events.filter((event) => event.type === "patch")).toHaveLength(5);
  });

  it("keeps the valid initial site when automatic repair is unavailable", async () => {
    const weakQualityDecision = {
      provider: "typesafe",
      model: "jev",
      answers: {
        coverage: {
          type: "score",
          score: 0,
          legend: { 0: "poor", 1: "partial", 2: "near", 3: "complete" },
          probabilities: { 0: 0.97 },
          confidence: 0.97,
        },
      },
    };

    mocks.tryDecide.mockResolvedValueOnce(planDecision).mockResolvedValueOnce(weakQualityDecision);
    mocks.stream
      .mockResolvedValueOnce(sseStreamOf(modelOutput))
      .mockRejectedValueOnce(new Error("provider unavailable"));

    const events = await readEvents(
      await streamSiteGeneration({
        context,
        user,
        request: { prompt: "A landing page for a bakery in Leeds" },
      }),
    );
    const saved = mocks.finaliseSiteGeneration.mock.calls[0][3];

    expect(saved.project.pages.home).toBeDefined();
    expect(saved.turn.trace).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "generation",
          stage: "repair",
          outcome: "discarded",
          summary: expect.stringContaining("original site was kept"),
        }),
      ]),
    );
    expect(events.at(-1)).toMatchObject({ type: "done" });
  });
});
