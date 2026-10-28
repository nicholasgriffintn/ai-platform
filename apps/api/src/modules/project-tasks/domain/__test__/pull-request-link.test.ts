import { describe, expect, it } from "vitest";

import { parseGitHubPullRequestUrl } from "../pull-request-link";

describe("parseGitHubPullRequestUrl", () => {
  it("normalises a pull request address so webhooks find the task", () => {
    expect(parseGitHubPullRequestUrl("https://github.com/Acme/App/pull/12/files")).toEqual({
      repository: "acme/app",
      number: 12,
      url: "https://github.com/Acme/App/pull/12",
    });
  });

  it("refuses anything that isn't a GitHub pull request", () => {
    expect(parseGitHubPullRequestUrl("https://github.com/acme/app/issues/12")).toBeNull();
    expect(parseGitHubPullRequestUrl("https://gitlab.com/acme/app/pull/12")).toBeNull();
    expect(parseGitHubPullRequestUrl("https://github.com/acme/app/pull/0")).toBeNull();
  });
});
