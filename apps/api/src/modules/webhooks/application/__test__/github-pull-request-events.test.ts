import { describe, expect, it } from "vitest";

import { readGitHubChangesRequested, readGitHubCheckResult } from "../github-pull-request-events";

const repository = { full_name: "Acme/App" };
const sha = "a".repeat(40);

describe("GitHub pull request events", () => {
  it("reads a failed check run against its pull requests", () => {
    expect(
      readGitHubCheckResult("check_run", {
        action: "completed",
        repository,
        check_run: {
          name: "test",
          head_sha: sha,
          conclusion: "failure",
          html_url: "https://github.com/acme/app/runs/1",
          pull_requests: [{ number: 12 }],
        },
      }),
    ).toEqual({
      repository: "acme/app",
      pullRequests: [12],
      headSha: sha,
      conclusion: "failure",
      name: "test",
      url: "https://github.com/acme/app/runs/1",
    });
  });

  it("only treats reviews that request changes as fix-ups", () => {
    const review = (state: string) => ({
      action: "submitted",
      repository,
      pull_request: { number: 12 },
      review: { state, body: "Rename the helper", html_url: null, user: { login: "sam" } },
    });

    expect(readGitHubChangesRequested(review("changes_requested"))).toMatchObject({
      repository: "acme/app",
      pullRequest: 12,
      reviewer: "@sam",
      body: "Rename the helper",
    });
    expect(readGitHubChangesRequested(review("approved"))).toBeNull();
    expect(readGitHubChangesRequested(review("commented"))).toBeNull();
  });
});
