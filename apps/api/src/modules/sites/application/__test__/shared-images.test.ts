import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSharedOutputRecord: vi.fn(),
  getObjectBody: vi.fn(),
  getPrivateFileResponse: vi.fn(),
}));

vi.mock("~/modules/outputs/application", () => ({
  getSharedOutputRecord: mocks.getSharedOutputRecord,
}));
vi.mock("~/infrastructure/storage", () => ({
  StorageService: class {
    getObjectBody = mocks.getObjectBody;
  },
}));
vi.mock("~/infrastructure/storage/read-resource", () => ({
  getPrivateFileResponse: mocks.getPrivateFileResponse,
}));

import { readSharedSiteImage } from "~/modules/sites/application/shared-images";

const project = {
  title: "Crumb",
  theme: {
    palette: "sand",
    font: "sans",
    radius: "md",
    mode: "light",
    direction: "organic",
    density: "comfortable",
    texture: "grain",
    motion: "restrained",
  },
  capabilities: ["content", "navigation"],
  pages: {
    home: {
      path: "/",
      title: "Home",
      root: "page",
      elements: {
        page: { type: "Page", props: {}, children: ["shot"] },
        shot: {
          type: "Image",
          props: { alt: "Shop", src: "https://api.polychat.test/outputs/img-1/content" },
          children: [],
        },
      },
    },
  },
};

function contextWith(image: Record<string, unknown> | null) {
  return {
    env: { API_BASE_URL: "https://api.polychat.test", PRIVATE_ASSETS_BUCKET: {} },
    repositories: { outputs: { getOutput: vi.fn(async () => image) } },
  } as never;
}

describe("readSharedSiteImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSharedOutputRecord.mockResolvedValue({
      kind: "site",
      created_by_user_id: 7,
      content: JSON.stringify({ project }),
    });
    mocks.getObjectBody.mockResolvedValue({ arrayBuffer: async () => new ArrayBuffer(1) });
    mocks.getPrivateFileResponse.mockResolvedValue(new Response("ok"));
  });

  it("serves an image the shared site references and the same owner produced", async () => {
    const response = await readSharedSiteImage(
      contextWith({ created_by_user_id: 7, storage_key: "k", mime_type: "image/png" }),
      "t".repeat(32),
      "img-1",
    );

    expect(await response.text()).toBe("ok");
    expect(mocks.getObjectBody).toHaveBeenCalledWith("k");
  });

  it("refuses images the site does not reference or another user owns", async () => {
    await expect(
      readSharedSiteImage(
        contextWith({ created_by_user_id: 7, storage_key: "k", mime_type: "image/png" }),
        "t".repeat(32),
        "img-2",
      ),
    ).rejects.toThrow(/not part of this site/);

    await expect(
      readSharedSiteImage(
        contextWith({ created_by_user_id: 8, storage_key: "k", mime_type: "image/png" }),
        "t".repeat(32),
        "img-1",
      ),
    ).rejects.toThrow(/Image not found/);
    expect(mocks.getObjectBody).not.toHaveBeenCalled();
  });
});
