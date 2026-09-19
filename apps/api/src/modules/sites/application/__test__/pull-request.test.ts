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
vi.mock("~/modules/apps/application/sandbox/github-credentials", () => ({
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

function jsonResponse(body: unknown) {
  return { json: async () => body } as Response;
}

describe("openSitePullRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireProjectAccess.mockResolvedValue({ project: {}, role: "owner" });
    mocks.resolveProjectCodingEnvironment.mockReturnValue({
      repository: "acme/site",
      installationId: 42,
    });
    mocks.resolveSandboxGitHubToken.mockResolvedValue("token");
    mocks.getSite.mockResolvedValue(site);
    mocks.collectSiteImageAssets.mockResolvedValue([
      {
        path: "public/images/out-1.png",
        content: "aGVsbG8=",
        encoding: "base64",
        src: "https://api.polychat.test/outputs/out-1/content",
        publicPath: "/images/out-1.png",
      },
    ]);
    mocks.githubApiRequest.mockImplementation(async ({ url, method }) => {
      if (method === "GET" && url.endsWith("/repos/acme/site")) {
        return jsonResponse({ default_branch: "main" });
      }

      if (method === "GET" && url.includes("/git/ref/heads/main")) {
        return jsonResponse({ object: { sha: "base-sha" } });
      }

      if (method === "GET" && url.includes("/git/ref/heads/polychat%2Fsite-crumb-bakery")) {
        throw new Error("GitHub API error (404)");
      }

      if (method === "GET" && url.includes("/git/commits/base-sha")) {
        return jsonResponse({ tree: { sha: "tree-base" } });
      }

      if (url.endsWith("/git/blobs")) {
        return jsonResponse({ sha: "blob-1" });
      }

      if (url.endsWith("/git/trees")) {
        return jsonResponse({ sha: "tree-new" });
      }

      if (url.endsWith("/git/commits")) {
        return jsonResponse({ sha: "commit-new" });
      }

      if (url.endsWith("/git/refs")) {
        return jsonResponse({});
      }

      if (url.endsWith("/pulls")) {
        return jsonResponse({ number: 12, html_url: "https://github.com/acme/site/pull/12" });
      }

      throw new Error(`Unexpected request ${method} ${url}`);
    });
  });

  it("commits the generated files to a fresh branch under the directory and opens the PR", async () => {
    const result = await openSitePullRequest({
      context: {} as never,
      user: { id: 7 } as never,
      siteId: "site-1",
      request: { projectId: "project-1", directory: "apps/site/", target: "react-router" },
    });
    const calls = mocks.githubApiRequest.mock.calls.map(([params]) => params);
    const tree = calls.find((call) => call.url.endsWith("/git/trees"));
    const ref = calls.find((call) => call.url.endsWith("/git/refs"));
    const pull = calls.find((call) => call.url.endsWith("/pulls"));

    expect(result).toEqual({
      repo: "acme/site",
      branch: "polychat/site-crumb-bakery",
      number: 12,
      url: "https://github.com/acme/site/pull/12",
      fileCount: expect.any(Number),
    });
    expect(tree.body.base_tree).toBe("tree-base");
    expect(
      tree.body.tree.every((entry: { path: string }) => entry.path.startsWith("apps/site/")),
    ).toBe(true);
    expect(
      tree.body.tree.some(
        (entry: { path: string }) => entry.path === "apps/site/app/routes/home.tsx",
      ),
    ).toBe(true);
    expect(tree.body.tree).toContainEqual({
      path: "apps/site/public/images/out-1.png",
      mode: "100644",
      type: "blob",
      sha: "blob-1",
    });
    expect(ref.body).toEqual({ ref: "refs/heads/polychat/site-crumb-bakery", sha: "commit-new" });
    expect(pull.body).toMatchObject({ head: "polychat/site-crumb-bakery", base: "main" });
    expect(pull.body.body).toContain("A bakery site");
    expect(mocks.resolveSandboxGitHubToken).toHaveBeenCalledWith(
      expect.objectContaining({ repo: "acme/site", installationId: 42, userId: 7 }),
    );
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
