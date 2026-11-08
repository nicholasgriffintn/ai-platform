import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  githubApiRequest: vi.fn(),
  resolveSandboxGitHubToken: vi.fn(),
  requireProjectAccess: vi.fn(),
  requireProjectCapabilityAccess: vi.fn(),
  resolveProjectCodingEnvironment: vi.fn(),
  getSite: vi.fn(),
  collectSiteImageAssets: vi.fn(),
}));

vi.mock("~/infrastructure/github/api-client", () => ({ githubApiRequest: mocks.githubApiRequest }));
vi.mock("~/modules/sandbox/application/github-credentials", () => ({
  resolveSandboxGitHubToken: mocks.resolveSandboxGitHubToken,
}));
vi.mock("~/modules/workspaces/application/access", () => ({
  requireProjectAccess: mocks.requireProjectAccess,
  requireProjectCapabilityAccess: mocks.requireProjectCapabilityAccess,
}));
vi.mock("~/modules/workspaces/application/projectCodingEnvironment", () => ({
  resolveProjectCodingEnvironment: mocks.resolveProjectCodingEnvironment,
}));
vi.mock("~/modules/sites/application/records", () => ({ getSite: mocks.getSite }));
vi.mock("~/modules/sites/application/images", () => ({
  collectSiteImageAssets: mocks.collectSiteImageAssets,
}));

import { openSitePullRequest } from "~/modules/sites/application/pull-request";

const site = {
  id: "site-1",
  title: "Crumb Bakery",
  brief: "A bakery site",
  projectId: "project-1",
  revision: 1,
  plan: {} as never,
  project: {
    title: "Crumb Bakery",
    theme: { palette: "sand", font: "sans", radius: "md", mode: "light" },
    pages: {
      home: {
        path: "/",
        title: "Home",
        root: "page",
        elements: {
          page: { type: "Page", props: {}, children: ["hero"] },
          hero: { type: "Hero", props: { headline: "Hi" }, children: [] },
        },
      },
    },
  },
  issues: [],
  turns: [],
  createdAt: "",
  updatedAt: null,
};

describe("openSitePullRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireProjectAccess.mockResolvedValue({ project: {}, role: "owner" });
    mocks.resolveProjectCodingEnvironment.mockReturnValue({
      repository: "acme/site",
      installationId: 42,
    });
    mocks.getSite.mockResolvedValue(site);
  });

  it("refuses without a coding environment or with a traversal directory", async () => {
    await expect(
      openSitePullRequest({
        context: {} as never,
        user: { id: 7 } as never,
        siteId: "site-1",
        request: {
          projectId: "project-1",
          directory: "../outside",
          target: "react-router",
        },
      }),
    ).rejects.toThrow(/leave the repository/);

    mocks.resolveProjectCodingEnvironment.mockReturnValue(null);

    await expect(
      openSitePullRequest({
        context: {} as never,
        user: { id: 7 } as never,
        siteId: "site-1",
        request: { projectId: "project-1", target: "react-router" },
      }),
    ).rejects.toThrow(/no coding environment/);
    expect(mocks.githubApiRequest).not.toHaveBeenCalled();
  });
});
