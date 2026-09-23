import type { SiteImageStreamEvent, SiteRecord } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ images: vi.fn() }));

vi.mock("@ngriffin_uk/polychat-library-client", () => ({
  sitesService: { images: mocks.images },
}));

import { runSiteImageGeneration } from "../sites/site-image-generation.js";

const site: SiteRecord = {
  id: "site-1",
  title: "Crumb",
  brief: "A bakery",
  projectId: null,
  revision: 1,
  plan: {
    kind: "landing",
    scope: "page",
    tier: "low",
    tone: "plain",
    theme: {
      palette: "sand",
      font: "sans",
      radius: "md",
      mode: "light",
      direction: "editorial",
      density: "spacious",
      texture: "clean",
      motion: "restrained",
    },
    interactive: false,
    capabilities: ["content"],
    confidence: 1,
  },
  project: {
    title: "Crumb",
    theme: {
      palette: "sand",
      font: "sans",
      radius: "md",
      mode: "light",
      direction: "editorial",
      density: "spacious",
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
          page: { type: "Page", props: {}, children: ["shot"] },
          shot: { type: "Image", props: { alt: "The shop front" }, children: [] },
        },
      },
    },
  },
  issues: [],
  quality: null,
  turns: [],
  createdAt: "",
  updatedAt: null,
};

describe("runSiteImageGeneration", () => {
  it("previews each streamed image patch before returning the saved site", async () => {
    const saved = structuredClone(site);

    saved.project.pages.home.elements.shot.props.src = "https://api/outputs/shot/content";
    mocks.images.mockImplementation(async (_id, _request, onEvent) => {
      const events: SiteImageStreamEvent[] = [
        {
          type: "progress",
          completed: 1,
          total: 1,
          failed: 0,
          patch: {
            op: "add",
            path: "/pages/home/elements/shot/props/src",
            value: "https://api/outputs/shot/content",
          },
        },
        { type: "saved", site: saved, generated: 1, failed: 0 },
      ];

      events.forEach(onEvent);
    });
    const onProgress = vi.fn();

    const result = await runSiteImageGeneration({ site, onProgress });

    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        completed: 1,
        total: 1,
        project: expect.objectContaining({
          pages: expect.objectContaining({
            home: expect.objectContaining({
              elements: expect.objectContaining({
                shot: expect.objectContaining({
                  props: expect.objectContaining({ src: "https://api/outputs/shot/content" }),
                }),
              }),
            }),
          }),
        }),
      }),
    );
    expect(result).toMatchObject({ site: saved, status: "done", error: null });
  });
});
