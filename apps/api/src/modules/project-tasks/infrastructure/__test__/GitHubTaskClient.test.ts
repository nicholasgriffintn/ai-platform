import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { githubApiRequest } from "~/infrastructure/github/api-client";

import {
  createGitHubReviewTestContext,
  locator,
  pr,
  comparison,
  queueCapture,
  target,
} from "../../../../../test/helpers/github-review";
import { GitHubTaskClient } from "../GitHubTaskClient";

vi.mock("~/infrastructure/github/api-client", () => ({ githubApiRequest: vi.fn() }));
vi.mock("~/infrastructure/github", () => ({ getGitHubAppInstallationToken: vi.fn() }));
vi.mock("~/modules/github/application/connections", () => ({ getGitHubTaskConnection: vi.fn() }));
let fixture: Awaited<ReturnType<typeof createGitHubReviewTestContext>>;

beforeEach(async () => {
  vi.clearAllMocks();
  fixture = await createGitHubReviewTestContext();
});
afterEach(async () => {
  vi.restoreAllMocks();
  await fixture?.runtime.dispose();
});

describe("GitHubTaskClient exact diff capture", () => {
  it("uses exact commits and retains missing patch coverage", async () => {
    queueCapture();
    const client = await GitHubTaskClient.forUser(fixture.context, 10, "owner/repo");
    const captured = await client.captureReview(locator);

    expect(githubApiRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: `https://api.github.com/repos/owner/repo/compare/${target.baseSha}...${target.headSha}`,
      }),
    );
    expect(captured.target).toEqual(target);
    expect(captured.omitted).toEqual(["asset.png"]);
    expect(captured.content).toContain(target.headSha);
    expect(captured.content).toContain("asset.png");
  });

  it("rejects commit movement during capture", async () => {
    vi.mocked(githubApiRequest)
      .mockResolvedValueOnce(Response.json(pr))
      .mockResolvedValueOnce(Response.json(comparison))
      .mockResolvedValueOnce(Response.json({ ...pr, head: { sha: "d".repeat(40) } }));
    const client = await GitHubTaskClient.forUser(fixture.context, 10, "owner/repo");

    await expect(client.captureReview(locator)).rejects.toMatchObject({ statusCode: 409 });
  });
});
