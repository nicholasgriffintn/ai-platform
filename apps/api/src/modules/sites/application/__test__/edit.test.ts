import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getSite: vi.fn(), updateSite: vi.fn() }));

vi.mock("~/modules/sites/application/records", () => ({
  getSite: mocks.getSite,
  updateSite: mocks.updateSite,
}));

import { editSite } from "~/modules/sites/application/edit";

const context = {} as never;
const user = { id: 7 } as never;

const site = {
  id: "site-1",
  title: "Crumb",
  brief: "A bakery site",
  projectId: null,
  revision: 3,
  plan: {
    kind: "landing",
    scope: "page",
    tier: "low",
    tone: "friendly",
    theme: { palette: "sand", font: "sans", radius: "md", mode: "light" },
    interactive: false,
    confidence: 0.8,
  },
  project: {
    title: "Crumb",
    theme: { palette: "sand", font: "sans", radius: "md", mode: "light" },
    pages: {
      home: {
        path: "/",
        title: "Home",
        root: "page",
        elements: {
          page: { type: "Page", props: {}, children: ["hero", "footer"] },
          hero: { type: "Hero", props: { headline: "Old" }, children: [] },
          footer: { type: "Footer", props: { brand: "Crumb" }, children: [] },
        },
      },
    },
  },
  issues: [],
  turns: [],
  createdAt: "2026-09-19T00:00:00.000Z",
  updatedAt: null,
};

describe("editSite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSite.mockResolvedValue(site);
    mocks.updateSite.mockImplementation(async (_scope, id, input) => ({
      ...site,
      id,
      revision: 4,
      ...input,
    }));
  });

  it("applies inspector patches, validates and records an edit turn", async () => {
    const result = await editSite({
      context,
      user,
      siteId: "site-1",
      request: {
        summary: "Edited Hero",
        patches: [
          {
            op: "replace",
            path: "/pages/home/elements/hero/props",
            value: { headline: "New", layout: "split" },
          },
          { op: "replace", path: "/pages/home/elements/page/children", value: ["footer", "hero"] },
        ],
      },
    });
    const input = mocks.updateSite.mock.calls[0][2];

    expect(input.project.pages.home.elements.hero.props).toEqual({
      headline: "New",
      layout: "split",
    });
    expect(input.project.pages.home.elements.page.children).toEqual(["footer", "hero"]);
    expect(input.turn).toMatchObject({ role: "edit", prompt: "Edited Hero" });
    expect(input.brief).toBe("A bakery site");
    expect(result.revision).toBe(4);
  });

  it("rejects edits that cannot apply or empty the site", async () => {
    await expect(
      editSite({
        context,
        user,
        siteId: "site-1",
        request: {
          summary: "Broken",
          patches: [{ op: "add", path: "/pages/home/elements/hero/props/headline/0", value: 1 }],
        },
      }),
    ).rejects.toThrow(/could not be applied/);

    await expect(
      editSite({
        context,
        user,
        siteId: "site-1",
        request: { summary: "Wipe", patches: [{ op: "remove", path: "/pages" }] },
      }),
    ).rejects.toThrow(/no pages/);
    expect(mocks.updateSite).not.toHaveBeenCalled();
  });
});
