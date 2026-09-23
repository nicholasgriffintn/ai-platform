import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getSite: vi.fn(), updateSite: vi.fn(), generateImage: vi.fn() }));

vi.mock("~/modules/sites/application/records", () => ({
  getSite: mocks.getSite,
  updateSite: mocks.updateSite,
}));
vi.mock("~/modules/generate/application/image", () => ({ generateImage: mocks.generateImage }));
vi.mock("~/infrastructure/storage", () => ({ StorageService: { forPrivateAssets: () => ({}) } }));

import { fillSiteImages, streamSiteImages } from "~/modules/sites/application/images";

const site = {
  id: "site-1",
  title: "Crumb",
  brief: "A bakery",
  projectId: null,
  revision: 1,
  plan: {} as never,
  project: {
    title: "Crumb",
    description: "A bakery in Leeds.",
    theme: { palette: "sand", font: "sans", radius: "md", mode: "light" },
    pages: {
      home: {
        path: "/",
        title: "Home",
        root: "page",
        elements: {
          page: { type: "Page", props: {}, children: ["hero", "shot"] },
          hero: {
            type: "Hero",
            props: { headline: "Hi", layout: "split", image: { alt: "Cakes on a counter" } },
            children: [],
          },
          shot: { type: "Image", props: { alt: "The shop front" }, children: [] },
        },
      },
    },
  },
  issues: [],
  turns: [],
  createdAt: "",
  updatedAt: null,
};

describe("fillSiteImages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSite.mockResolvedValue(site);
    mocks.updateSite.mockImplementation(async (_scope, id, input) => ({
      ...site,
      id,
      revision: 2,
      ...input,
    }));
  });

  it("generates one image per empty slot from its alt text and saves the patched site", async () => {
    mocks.generateImage.mockImplementation(async ({ args }) => ({
      status: "success",
      name: "create_image",
      content: "",
      data: {
        url: `https://api/outputs/${args.prompt.startsWith("Cakes") ? "hero" : "shot"}/content`,
      },
    }));

    const result = await fillSiteImages({
      context: { env: { APP_BASE_URL: "https://app" } } as never,
      user: { id: 7 } as never,
      siteId: "site-1",
    });
    const prompts = mocks.generateImage.mock.calls.map(([params]) => params.args);
    const saved = mocks.updateSite.mock.calls[0][2];

    expect(result.generated).toBe(2);
    expect(result.failed).toBe(0);
    expect(prompts.map((args) => args.aspect_ratio)).toEqual(["16:9", "16:9"]);
    expect(prompts[0].prompt).toContain("for A bakery in Leeds");
    expect(saved.project.pages.home.elements.hero.props.image).toEqual({
      alt: "Cakes on a counter",
      src: "https://api/outputs/hero/content",
    });
    expect(saved.project.pages.home.elements.shot.props.src).toBe(
      "https://api/outputs/shot/content",
    );
    expect(saved.turn).toMatchObject({ role: "edit", prompt: "Generated 2 images" });
  });

  it("reports each completed image before the slowest image finishes", async () => {
    let resolveHero: (result: Record<string, unknown>) => void = () => {};

    let resolveShot: (result: Record<string, unknown>) => void = () => {};

    const hero = new Promise<Record<string, unknown>>((resolve) => {
      resolveHero = resolve;
    });
    const shot = new Promise<Record<string, unknown>>((resolve) => {
      resolveShot = resolve;
    });
    const onProgress = vi.fn();

    mocks.generateImage.mockImplementation(({ args }) =>
      args.prompt.startsWith("Cakes") ? hero : shot,
    );

    const result = fillSiteImages({
      context: { env: { APP_BASE_URL: "https://app" } } as never,
      user: { id: 7 } as never,
      siteId: "site-1",
      onProgress,
    });

    await vi.waitFor(() => expect(mocks.generateImage).toHaveBeenCalledTimes(2));
    resolveHero({
      status: "success",
      data: { url: "https://api/outputs/hero/content" },
    });

    await vi.waitFor(() => expect(onProgress).toHaveBeenCalledTimes(1));
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({ completed: 1, total: 2, failed: 0, patch: expect.any(Object) }),
    );

    resolveShot({
      status: "success",
      data: { url: "https://api/outputs/shot/content" },
    });

    await expect(result).resolves.toMatchObject({ generated: 2, failed: 0 });
  });

  it("keeps the site untouched when every generation fails", async () => {
    mocks.generateImage.mockResolvedValue({
      status: "error",
      name: "create_image",
      content: "no key",
      data: {},
    });

    const result = await fillSiteImages({
      context: { env: {} } as never,
      user: { id: 7 } as never,
      siteId: "site-1",
    });

    expect(result).toEqual({ site, generated: 0, failed: 2 });
    expect(mocks.updateSite).not.toHaveBeenCalled();
  });

  it("streams image progress before the final saved site", async () => {
    mocks.generateImage.mockImplementation(async ({ args }) => ({
      status: "success",
      data: {
        url: `https://api/outputs/${args.prompt.startsWith("Cakes") ? "hero" : "shot"}/content`,
      },
    }));

    const response = await streamSiteImages({
      context: { env: { APP_BASE_URL: "https://app" } } as never,
      user: { id: 7 } as never,
      siteId: "site-1",
    });
    const events = (await response.text())
      .split("\n")
      .filter((line) => line.startsWith("data: {") && !line.endsWith("[DONE]"))
      .map((line) => JSON.parse(line.slice(6)) as { type: string });

    expect(events.map((event) => event.type)).toEqual(["progress", "progress", "saved"]);
  });
});
