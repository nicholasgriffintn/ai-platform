import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getGitHubTaskConnection } from "~/modules/github/application/connections";

import {
  createGitHubReviewTestContext,
  locator,
  queueCapture,
} from "../../../../../test/helpers/github-review";
import { createPullRequestReview, setGithubReviewPolicy } from "../pull-request-review";
import { assertReviewDispatchAuthority } from "../review-authority";

vi.mock("~/infrastructure/github/api-client", () => ({ githubApiRequest: vi.fn() }));
vi.mock("~/infrastructure/github", () => ({ getGitHubAppInstallationToken: vi.fn() }));
vi.mock("~/modules/github/application/connections", () => ({ getGitHubTaskConnection: vi.fn() }));
vi.mock("~/modules/project-tasks/application/attention", () => ({
  reconcileTaskNotifications: vi.fn(),
}));

let fixture: Awaited<ReturnType<typeof createGitHubReviewTestContext>>;

beforeEach(async () => {
  vi.clearAllMocks();
  fixture = await createGitHubReviewTestContext();
});
afterEach(async () => {
  vi.restoreAllMocks();
  await fixture?.runtime.dispose();
});

describe("review dispatch authority", () => {
  it("allows an admin to disable automation after the connection is revoked", async () => {
    await fixture.context.repositories.projectTaskIntegrations.setPolicy({
      enabled: true,
      projectId: "project-1",
      ownerUserId: 7,
      connectionId: "connection-1",
      installationId: 10,
      repository: "owner/repo",
      tokenBudget: 20000,
      revision: "policy-1",
    });
    queueCapture();
    const { review } = await createPullRequestReview(fixture.context, "project-1", locator, {
      policyRevision: "policy-1",
    });
    const task = await fixture.context.repositories.projectTasks.getTaskById(review.taskId);

    if (!task) {
      throw new Error("Review task missing");
    }

    await assertReviewDispatchAuthority(fixture.context, task);
    vi.mocked(getGitHubTaskConnection).mockClear();
    vi.mocked(getGitHubTaskConnection).mockRejectedValue(new Error("Revoked"));
    const result = await setGithubReviewPolicy(fixture.context, "project-1", { enabled: false });

    expect(result.policy?.enabled).toBe(false);
    expect(getGitHubTaskConnection).not.toHaveBeenCalled();
    expect(
      await fixture.context.repositories.projectTasks.queueTaskForRun({
        taskId: task.id,
        projectId: task.projectId,
        runnerIdentityUserId: 7,
        dispatchTaskId: "disabled-dispatch",
        runner: task.runner ?? { kind: "conversation", teammateId: null, model: null, mode: null },
        tokenBudget: 20000,
        expectedStatus: task.status,
        expectedDispatchTaskId: task.dispatchTaskId,
        automaticReviewPolicyRevision: "policy-1",
      }),
    ).toBeNull();
    await expect(assertReviewDispatchAuthority(fixture.context, task)).rejects.toMatchObject({
      statusCode: 409,
    });
  });
});
