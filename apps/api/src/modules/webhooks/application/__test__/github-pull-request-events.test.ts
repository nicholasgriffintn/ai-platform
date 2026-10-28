import { describe, expect, it } from "vitest";

import {
  isGitHubCheckEvent,
  readGitHubChangesRequested,
  readGitHubCheckResult,
} from "../github-pull-request-events";

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

  it("reads workflow runs and suites, and ignores anything not yet completed", () => {
    expect(
      readGitHubCheckResult("workflow_run", {
        action: "completed",
        repository,
        workflow_run: { name: "CI", head_sha: sha, conclusion: "success", pull_requests: [] },
      })?.name,
    ).toBe("CI");
    expect(
      readGitHubCheckResult("check_suite", {
        action: "completed",
        repository,
        check_suite: { head_sha: sha, conclusion: "success", pull_requests: [{ number: 3 }] },
      })?.pullRequests,
    ).toEqual([3]);
    expect(
      readGitHubCheckResult("check_run", {
        action: "created",
        repository,
        check_run: { name: "test", head_sha: sha, conclusion: null, pull_requests: [] },
      }),
    ).toBeNull();
    expect(isGitHubCheckEvent("push")).toBe(false);
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
