import type { ProjectTaskCompletion, PullRequestReviewTarget } from "@ngriffin_uk/polychat-schemas";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getGitHubAppInstallationToken } from "~/infrastructure/github";
import { githubApiRequest } from "~/infrastructure/github/api-client";
import { getGitHubTaskConnection } from "~/modules/github/application/connections";
import {
  createPullRequestReview,
  prepareReviewPublication,
  publishPullRequestReview,
  reconcileReviewPublication,
  setGithubReviewPolicy,
} from "~/modules/project-tasks/application/pull-request-review";
import { assertReviewDispatchAuthority } from "~/modules/project-tasks/application/review-authority";
import { GitHubTaskClient } from "~/modules/project-tasks/infrastructure/GitHubTaskClient";

import { createIntegrationTestContext } from "./helpers/project-task-integrations";

vi.mock("~/infrastructure/github/api-client", () => ({ githubApiRequest: vi.fn() }));
vi.mock("~/infrastructure/github", () => ({ getGitHubAppInstallationToken: vi.fn() }));
vi.mock("~/modules/github/application/connections", () => ({ getGitHubTaskConnection: vi.fn() }));
vi.mock("~/modules/project-tasks/application/attention", () => ({
  reconcileTaskNotifications: vi.fn(),
}));

let fixture: Awaited<ReturnType<typeof createIntegrationTestContext>>;
const locator = { installationId: 10, repository: "owner/repo", pullRequestNumber: 42 };
const target: PullRequestReviewTarget = {
  ...locator,
  connectionId: "connection-1",
  repositoryId: 20,
  baseSha: "a".repeat(40),
  headSha: "b".repeat(40),
};
const pr = {
  number: 42,
  title: "Preserve filters",
  body: "Fix refresh",
  html_url: "https://github.com/owner/repo/pull/42",
  state: "open",
  draft: false,
  changed_files: 2,
  base: { sha: target.baseSha, repo: { id: 20, full_name: "owner/repo" } },
  head: { sha: target.headSha },
};
const comparison = {
  merge_base_commit: { sha: "c".repeat(40) },
  files: [
    {
      filename: "src/filters.ts",
      status: "modified",
      additions: 1,
      deletions: 1,
      patch: "@@ -1 +1 @@\n-old\n+new",
    },
    { filename: "asset.png", status: "added", additions: 0, deletions: 0 },
  ],
};

beforeEach(async () => {
  vi.clearAllMocks();
  fixture = await createIntegrationTestContext();
  await fixture.database
    .prepare(
      "INSERT INTO provider_connection (id, user_id, provider, kind, external_id, encrypted_data) VALUES ('connection-1', 7, 'github', 'github_app', '10', '{}')",
    )
    .run();
  vi.mocked(getGitHubTaskConnection).mockResolvedValue({
    connectionId: "connection-1",
    connection: {
      appId: "1",
      privateKey: "test-key",
      installationId: 10,
      webhookSecret: "test-secret",
    },
  });
  vi.mocked(getGitHubAppInstallationToken).mockResolvedValue("test-token");
});
afterEach(async () => {
  vi.restoreAllMocks();
  await fixture?.runtime.dispose();
});

function queueCapture() {
  vi.mocked(githubApiRequest)
    .mockResolvedValueOnce(Response.json(pr))
    .mockResolvedValueOnce(Response.json(comparison))
    .mockResolvedValueOnce(Response.json(pr));
}

async function completedReview() {
  queueCapture();
  const { review } = await createPullRequestReview(fixture.context, "project-1", locator);
  const conversationId = "review-conversation";

  await fixture.database
    .prepare("INSERT INTO conversation (id, user_id, project_id) VALUES (?, 7, 'project-1')")
    .bind(conversationId)
    .run();
  const completion: ProjectTaskCompletion = {
    id: "completion-1",
    stageId: "review",
    conversationId,
    goalId: "goal-1",
    output: "One actionable finding in src/filters.ts:1. The binary asset was not reviewed.",
    evidence: [],
    approval: { mode: "human", status: "pending", reviewedByUserId: null, reviewedAt: null },
    createdAt: "2026-10-04T00:00:00Z",
  };

  await fixture.context.repositories.projectTasks.updateTask(review.taskId, {
    status: "review",
    completions: [completion],
  });

  return { review, completion };
}

describe("exact GitHub diff capture", () => {
  it("reuses a review for repeated delivery and creates new work for a changed commit", async () => {
    queueCapture();
    const first = await createPullRequestReview(fixture.context, "project-1", locator);

    queueCapture();
    expect(await createPullRequestReview(fixture.context, "project-1", locator)).toMatchObject({
      reused: true,
      review: { taskId: first.review.taskId },
    });
    const next = { ...pr, head: { sha: "d".repeat(40) } };

    vi.mocked(githubApiRequest)
      .mockResolvedValueOnce(Response.json(next))
      .mockResolvedValueOnce(Response.json(comparison))
      .mockResolvedValueOnce(Response.json(next));
    const changed = await createPullRequestReview(fixture.context, "project-1", locator);

    expect(changed.review.taskId).not.toBe(first.review.taskId);
    expect(
      await fixture.context.repositories.projectTasks.listProjectTasks("project-1"),
    ).toHaveLength(2);
  });
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

describe("human publication and uncertain outcomes", () => {
  it("prepares a governed output without posting, then publishes once with the reviewed commit", async () => {
    const { review, completion } = await completedReview();
    const prepared = await prepareReviewPublication(fixture.context, "project-1", review.id);

    expect(prepared.body).toBe(completion.output);
    expect(await fixture.context.repositories.outputs.getOutput(prepared.outputId)).toMatchObject({
      project_id: "project-1",
      kind: "code-review",
    });
    expect(
      vi.mocked(githubApiRequest).mock.calls.every(([request]) => request.method === "GET"),
    ).toBe(true);
    vi.mocked(githubApiRequest)
      .mockResolvedValueOnce(Response.json(pr))
      .mockResolvedValueOnce(
        Response.json({ html_url: "https://github.com/owner/repo/pull/42#pullrequestreview-100" }),
      );
    await publishPullRequestReview(fixture.context, "project-1", review.id, {
      completionId: completion.id,
      body: "Human-approved review text",
    });
    await publishPullRequestReview(fixture.context, "project-1", review.id, {
      completionId: completion.id,
      body: "Human-approved review text",
    });
    const writes = vi
      .mocked(githubApiRequest)
      .mock.calls.filter(([request]) => request.method === "POST");

    expect(writes).toHaveLength(1);
    expect(writes[0][0].body).toMatchObject({
      commit_id: target.headSha,
      event: "COMMENT",
      body: expect.stringContaining("Human-approved review text"),
    });
  });

  it("refuses stale commits and a different credential owner", async () => {
    const { review, completion } = await completedReview();

    vi.mocked(githubApiRequest).mockResolvedValueOnce(
      Response.json({ ...pr, head: { sha: "d".repeat(40) } }),
    );
    await expect(
      publishPullRequestReview(fixture.context, "project-1", review.id, {
        completionId: completion.id,
        body: "Review",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    vi.mocked(getGitHubTaskConnection).mockResolvedValue({
      connectionId: "connection-2",
      connection: {
        appId: "1",
        privateKey: "test-key",
        installationId: 10,
        webhookSecret: "test-secret",
      },
    });
    await expect(
      publishPullRequestReview(fixture.context, "project-1", review.id, {
        completionId: completion.id,
        body: "Review",
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(
      vi.mocked(githubApiRequest).mock.calls.filter(([request]) => request.method === "POST"),
    ).toHaveLength(0);
  });

  it("does not retry a timed-out publication and reconciles a matching GitHub review", async () => {
    const { review, completion } = await completedReview();

    vi.mocked(githubApiRequest)
      .mockResolvedValueOnce(Response.json(pr))
      .mockRejectedValueOnce(new Error("Response lost"));
    await expect(
      publishPullRequestReview(fixture.context, "project-1", review.id, {
        completionId: completion.id,
        body: "Approved",
      }),
    ).rejects.toThrow("Response lost");
    expect(
      await fixture.context.repositories.projectTaskIntegrations.getReview(review.id),
    ).toMatchObject({ publicationStatus: "unknown" });
    vi.mocked(githubApiRequest).mockResolvedValueOnce(Response.json(pr));
    await expect(
      publishPullRequestReview(fixture.context, "project-1", review.id, {
        completionId: completion.id,
        body: "Approved",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    const body = await fixture.context.repositories.projectTaskIntegrations.getPublicationBody(
      review.id,
    );

    vi.mocked(githubApiRequest).mockResolvedValueOnce(
      Response.json([
        {
          commit_id: target.headSha,
          body,
          state: "COMMENTED",
          html_url: "https://github.com/owner/repo/pull/42#pullrequestreview-100",
        },
      ]),
    );
    const reconciled = await reconcileReviewPublication(fixture.context, "project-1", review.id);

    expect(reconciled.review?.publicationStatus).toBe("published");
    expect(
      vi.mocked(githubApiRequest).mock.calls.filter(([request]) => request.method === "POST"),
    ).toHaveLength(1);
  });

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
