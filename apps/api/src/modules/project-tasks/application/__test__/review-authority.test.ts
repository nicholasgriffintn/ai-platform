import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getGitHubTaskConnection } from "~/modules/github/application/connections";

import {
  createGitHubReviewTestContext,
  locator,
  queueCapture,
} from "../../../../../test/helpers/github-review";
import { createPullRequestReview } from "../pull-request-review";
import { assertReviewDispatchAuthority } from "../review-authority";
import { setProjectReviewPolicy } from "../review-policy";

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
    const policy = {
      enabled: true,
      projectId: "project-1",
      ownerUserId: 7,
      connectionId: "connection-1",
      id: "policy-1",
      workspaceId: "workspace-1",
      provider: "github",
      accountId: "10",
      repository: "owner/repo",
      tokenBudget: 20000,
      revision: "policy-1",
    };

    await fixture.database
      .prepare("INSERT INTO user (id, email, plan_id) VALUES (8, 'other@example.test', 'pro')")
      .run();
    await fixture.database
      .prepare(
        "INSERT INTO workspace_member (workspace_id, user_id, role) VALUES ('workspace-1', 8, 'admin')",
      )
      .run();
    await fixture.database
      .prepare(
        "INSERT INTO provider_connection (id, user_id, provider, kind, external_id, encrypted_data) VALUES ('connection-2', 8, 'github', 'github_app', '10', '{}')",
      )
      .run();
    await fixture.database
      .prepare(
        "INSERT INTO workspace (id, name, created_by) VALUES ('workspace-2', 'Other workspace', 7)",
      )
      .run();
    await fixture.database
      .prepare(
        "INSERT INTO project (id, workspace_id, name, created_by) VALUES ('project-2', 'workspace-2', 'Other project', 7)",
      )
      .run();
    const repository = fixture.context.repositories.projectTaskIntegrations;

    await repository.setPolicy(policy);
    await repository.setPolicy({
      ...policy,
      id: "other-owner-policy",
      ownerUserId: 8,
      connectionId: "connection-2",
    });
    await repository.setPolicy({
      ...policy,
      id: "other-workspace-policy",
      projectId: "project-2",
      workspaceId: "workspace-2",
    });
    expect(await repository.listProjectPolicies("project-1")).toHaveLength(2);
    expect(await repository.getPolicy("other-workspace-policy", "project-1")).toBeNull();
    expect(await repository.listPolicies("github", "10", "owner/repo")).toHaveLength(3);
    queueCapture();
    const { review } = await createPullRequestReview(fixture.context, "project-1", locator, {
      policy,
    });
    const task = await fixture.context.repositories.projectTasks.getTaskById(review.taskId);

    if (!task) {
      throw new Error("Review task missing");
    }

    await assertReviewDispatchAuthority(fixture.context, task);
    vi.mocked(getGitHubTaskConnection).mockClear();
    vi.mocked(getGitHubTaskConnection).mockRejectedValue(new Error("Revoked"));
    const result = await setProjectReviewPolicy(fixture.context, "project-1", {
      enabled: false,
      id: policy.id,
    });

    expect(result.policy.enabled).toBe(false);
    expect(await repository.getPolicy("other-owner-policy", "project-1")).toMatchObject({
      enabled: true,
      ownerUserId: 8,
    });
    expect(await repository.getPolicy("other-workspace-policy", "project-2")).toMatchObject({
      enabled: true,
      workspaceId: "workspace-2",
    });
    await expect(
      setProjectReviewPolicy(fixture.context, "project-1", {
        enabled: false,
        id: "other-workspace-policy",
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
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
