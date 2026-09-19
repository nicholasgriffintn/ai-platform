import { parseServerSentEventBuffer } from "@ngriffin_uk/polychat-utility-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  tryDecide: vi.fn(),
  stream: vi.fn(),
  resolveSiteGenerationModel: vi.fn(),
  createSite: vi.fn(),
  updateSite: vi.fn(),
  getSite: vi.fn(),
}));

vi.mock("~/infrastructure/ai", () => ({
  ai: { tryDecide: mocks.tryDecide, stream: mocks.stream },
}));
vi.mock("~/modules/sites/application/model", () => ({
  resolveSiteGenerationModel: mocks.resolveSiteGenerationModel,
}));
vi.mock("~/modules/sites/application/records", () => ({
  createSite: mocks.createSite,
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

describe("streamSiteGeneration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      turns: [input.turn],
      createdAt: "2026-09-19T00:00:00.000Z",
      updatedAt: null,
    }));
  });

  it("classifies with Jev, streams patches as they arrive, repairs the document and saves it", async () => {
    mocks.tryDecide.mockResolvedValue({
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
    });

    const response = await streamSiteGeneration({
      context,
      user,
      request: { prompt: "A landing page for a bakery in Leeds" },
    });
    const events = await readEvents(response);
    const types = events.map((event) => event.type);

    expect(types.slice(0, 2)).toEqual(["plan", "model"]);
    expect(types.filter((type) => type === "patch")).toHaveLength(5);
    expect(events.at(-1)).not.toHaveProperty("error");
    expect(types.slice(-2)).toEqual(["saved", "done"]);

    const plan = events[0].plan as Record<string, unknown>;

    expect(plan).toMatchObject({
      kind: "landing",
      scope: "page",
      tier: "low",
      provider: "test",
      model: "test-model",
    });
    expect((plan.theme as Record<string, unknown>).palette).toBe("sunset");
    expect(mocks.resolveSiteGenerationModel).toHaveBeenCalledWith(
      expect.objectContaining({ tier: "low", requestedModel: undefined }),
    );

    const streamRequest = mocks.stream.mock.calls[0][0];

    expect(streamRequest.system).toContain("OUTPUT FORMAT");
    expect(streamRequest.system).toContain("- Hero");
    expect(streamRequest.system).toContain("BRIEF GUIDANCE");
    expect(streamRequest.system).not.toContain("- Metric");
    expect(streamRequest.prompt_cache_key).toMatch(/^sites-generate-/);
    expect(streamRequest.prompt).toContain("A landing page for a bakery in Leeds");

    const saved = mocks.createSite.mock.calls[0][1];

    expect(saved.project.title).toBe("Crumb");
    expect(Object.keys(saved.project.pages.home.elements)).toEqual(["page", "hero"]);
    expect(saved.project.pages.home.elements.page.children).toEqual(["hero"]);
    expect(saved.project.pages.home.elements.hero.props).toEqual({
      headline: "Cakes worth the drive",
    });
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

    expect(events[0]).toMatchObject({ type: "plan", plan: { kind: "dashboard", tier: "low" } });
    expect((events[0].plan as Record<string, unknown>).answers).toBeUndefined();

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
      "plan",
      "intent",
      "model",
      "patch",
      "saved",
      "done",
    ]);
    expect(events[1]).toMatchObject({ type: "intent", intent: "restructure", target: null });

    const updated = mocks.updateSite.mock.calls[0][2];

    expect(updated.brief).toBe("A landing page for a bakery in Leeds");
    expect(updated.project.pages.home.elements.hero.props.headline).toBe("New headline");
    expect((events[4].site as { revision: number }).revision).toBe(2);
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
              page: { type: "Page", props: {}, children: ["hero", "footer"] },
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

    expect(system).toContain("SELECTED ELEMENT");
    expect(system).toContain("/pages/home/elements/hero");
    expect(system).toContain('hero: Hero "Old headline"');
    expect(system).not.toContain('"brand":"Crumb"');
    expect(events.map((event) => event.type)).toEqual(["plan", "model", "patch", "saved", "done"]);

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
});
