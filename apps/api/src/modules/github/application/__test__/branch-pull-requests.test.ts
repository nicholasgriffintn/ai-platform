import { agentPullRequestRequestSchema } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  githubApiRequest: vi.fn(),
  resolveSandboxGitHubToken: vi.fn(async () => "installation-token"),
}));

vi.mock("~/infrastructure/github/api-client", () => ({ githubApiRequest: mocks.githubApiRequest }));
vi.mock("~/modules/sandbox/application/github-credentials", () => ({
  resolveSandboxGitHubToken: mocks.resolveSandboxGitHubToken,
}));

import { openBranchPullRequest } from "../branch-pull-requests";

const BASE = "a".repeat(40);
const HEAD = "b".repeat(40);
const context = Object.assign(Object.create(null), { requireUser: () => ({ id: 7 }) });
const request = agentPullRequestRequestSchema.parse({
  changes: {
    repository: "acme/app",
    branch: "polychat/conversation-1",
    baseBranch: "main",
    baseCommit: BASE,
    headCommit: HEAD,
    files: [
      { path: "src/app.ts", deleted: false, executable: false, contentBase64: "aGVsbG8=" },
      { path: "old.txt", deleted: true, executable: false, contentBase64: null },
    ],
  },
  title: "Tidy the app",
  body: "From Polychat",
});

function respond(routes: {
  branchHead: string | null;
  openPulls: unknown[];
  baseMissing?: boolean;
}) {
  mocks.githubApiRequest.mockImplementation(async ({ url, method }) => {
    const json = (body: unknown) => Response.json(body);

    if (method === "GET" && url.endsWith(`/git/commits/${BASE}`)) {
      if (routes.baseMissing) {
        throw new AssistantError("GitHub API error (404)", ErrorType.EXTERNAL_API_ERROR, 404);
      }

      return json({ sha: BASE, tree: { sha: "base-tree" } });
    }

    if (method === "GET" && url.includes("/git/ref/heads/")) {
      if (!routes.branchHead) {
        throw new AssistantError("GitHub API error (404)", ErrorType.EXTERNAL_API_ERROR, 404);
      }

      return json({ object: { sha: routes.branchHead } });
    }

    if (url.endsWith("/git/blobs")) {
      return json({ sha: "blob-1" });
    }

    if (url.endsWith("/git/trees")) {
      return json({ sha: "tree-new" });
    }

    if (url.endsWith("/git/commits")) {
      return json({ sha: "commit-new" });
    }

    if (url.includes("/git/refs")) {
      return json({ object: { sha: "commit-new" } });
    }

    if (method === "GET" && url.includes("/pulls?")) {
      return json(routes.openPulls);
    }

    if (method === "POST" && url.endsWith("/pulls")) {
      return json({ number: 5, html_url: "https://github.com/acme/app/pull/5" });
    }

    throw new Error(`Unexpected ${method} ${url}`);
  });
}

function call(fragment: string, method?: string) {
  return mocks.githubApiRequest.mock.calls
    .map(([params]) => params)
    .find((params) => params.url.includes(fragment) && (!method || params.method === method));
}

describe("openBranchPullRequest", () => {
  beforeEach(() => {
    mocks.githubApiRequest.mockReset();
  });

  it("builds the branch on top of its base and opens a pull request", async () => {
    respond({ branchHead: null, openPulls: [] });

    await expect(openBranchPullRequest(context, request)).resolves.toMatchObject({
      number: 5,
      created: true,
      branch: "polychat/conversation-1",
    });
    expect(call("/git/trees")?.body).toEqual({
      base_tree: "base-tree",
      tree: [
        { path: "src/app.ts", mode: "100644", type: "blob", sha: "blob-1" },
        { path: "old.txt", mode: "100644", type: "blob", sha: null },
      ],
    });
    expect(call("/git/commits", "POST")?.body).toMatchObject({ parents: [BASE] });
    expect(call("/git/refs", "POST")?.body).toEqual({
      ref: "refs/heads/polychat/conversation-1",
      sha: "commit-new",
    });
  });

  it("moves an existing branch forward and keeps its open pull request", async () => {
    respond({
      branchHead: "c".repeat(40),
      openPulls: [{ number: 3, html_url: "https://github.com/acme/app/pull/3" }],
    });

    await expect(openBranchPullRequest(context, request)).resolves.toMatchObject({
      number: 3,
      created: false,
    });
    expect(call("/git/commits", "POST")?.body).toMatchObject({ parents: ["c".repeat(40)] });
    expect(call("/git/refs/heads/", "PATCH")?.body).toEqual({ sha: "commit-new", force: false });
    expect(call("/pulls", "POST")).toBeUndefined();
  });

  it("asks for the base branch to be pushed when GitHub doesn't have it", async () => {
    respond({ branchHead: null, openPulls: [], baseMissing: true });

    await expect(openBranchPullRequest(context, request)).rejects.toThrow("Push main first");
  });

  it("refuses branches outside Polychat's namespace and paths that leave the repository", () => {
    const parse = (changes: Record<string, unknown>) =>
      agentPullRequestRequestSchema.safeParse({
        title: "x",
        changes: { ...request.changes, ...changes },
      }).success;

    expect(parse({ branch: "main" })).toBe(false);
    expect(
      parse({
        files: [
          { path: "../etc/passwd", deleted: false, executable: false, contentBase64: "eA==" },
        ],
      }),
    ).toBe(false);
  });
});
